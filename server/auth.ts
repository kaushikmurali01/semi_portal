import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import connectPg from "connect-pg-simple";
import { nanoid } from "nanoid";
import { generateTwoFactorSecret, verifyTwoFactorToken, generateQRCodeDataURL } from "./twoFactorAuth";
import { sendEmailVerificationEmail } from "./sendgrid";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const bcrypt = await import('bcrypt');
  return bcrypt.hash(password, 10);
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    // Check if it's a bcrypt hash (starts with $2b$)
    if (stored.startsWith('$2b$')) {
      const bcrypt = await import('bcrypt');
      return await bcrypt.default.compare(supplied, stored);
    }
    
    // Legacy format for existing passwords
    const [hashed, salt] = stored.split(".");
    if (!salt) return false;
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-secret-key-change-this",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));

  // Register endpoint
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { 
        email, password, firstName, lastName, businessMobile, userType, role, companyName, companyShortName,
        businessNumber, companyWebsite, streetAddress, city, province, country, postalCode,
        howHeardAbout, howHeardAboutOther, agreeToPortalServices, agreeToBusinessInfo, agreeToContact,
        phone, website, serviceRegions, supportedActivities, capitalRetrofitTechnologies,
        hasCodeOfConductAgreement, hasPrivacyPolicyAgreement, hasTermsOfServiceAgreement, hasDataSharingAgreement,
        acceptTerms, acceptBusinessInfo, acceptContact, codeOfConductAgreed, gstWcbInsuranceConfirmed
      } = req.body;



      // Validate password requirements
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,64}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({ 
          message: "Password must be 8-64 characters with lowercase, uppercase, digit, and symbol" 
        });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Generate 6-digit verification code
      const emailVerificationToken = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Create user with unique ID
      const userId = nanoid();
      // Detect company owner registration by presence of company fields
      const isCompanyOwner = !!(companyName && companyShortName && businessNumber);
      // Detect team member registration by userType field (frontend maps role to userType)
      const isTeamMember = userType === "team_member";

      const userRole = role || userType; // Handle both role and userType fields
      
      console.log("[REGISTRATION DEBUG] Registration type detection:", {
        userType,
        role,
        userRole,
        companyName,
        companyShortName,
        businessNumber,
        isCompanyOwner,
        isTeamMember
      });

      
      const assignedRole = isCompanyOwner ? "company_admin" as const : 
                          isTeamMember ? "team_member" as const :
                          (userRole === "contractor_individual" || userType === "contractor") ? "contractor_individual" as const : "team_member" as const;

      const userData = {
        id: userId,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        businessMobile: businessMobile || null,
        emailVerificationToken,
        verificationTokenExpiry,
        isEmailVerified: false,
        role: assignedRole
      };

      let user = await storage.upsertUser(userData);

      // Check if email was already verified in session (from popup verification)
      const emailVerified = (req.session as any)?.emailVerified;
      if (emailVerified === email) {
        // Update user to mark as verified since they completed verification in popup
        user = await storage.updateUser(user.id, {
          isEmailVerified: true,
          emailVerifiedAt: new Date()
        });

      }

      // Handle team member registration
      if (isTeamMember) {
        console.log("[TEAM MEMBER REGISTRATION] Processing team member registration for:", email);
        // Validate required fields for team members
        if (!companyName) {
          return res.status(400).json({ 
            message: "Company name is required for team member registration" 
          });
        }

        // Find the company by name
        const existingCompany = await storage.getCompanyByName(companyName);
        if (!existingCompany) {
          return res.status(400).json({ 
            message: "Company not found. Please verify the exact company name or contact your company administrator." 
          });
        }

        // Update user with company association and mark as verified (team members don't need email verification)
        user = await storage.updateUser(user.id, {
          companyId: existingCompany.id,
          role: "team_member" as const,
          isEmailVerified: true,
          emailVerifiedAt: new Date()
        });

        // Send notification email to team member about pending approval
        // Note: This is different from email verification - it's a notification about what to expect
        try {
          const { sendTeamMemberPendingEmail } = await import('./sendgrid');
          await sendTeamMemberPendingEmail(email, firstName, existingCompany.name);
        } catch (error) {
          console.error("Failed to send team member notification email:", error);
          // Don't fail the registration if email fails
        }
        
        return res.status(201).json({
          message: "Registration submitted successfully! Your request is pending approval from your company administrator. You will receive an email confirmation once approved.",
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            companyId: user.companyId
          },
          requiresEmailVerification: false,
          isPending: true
        });
      }

      // Handle contractor registration
      if (userRole === "contractor_individual") {
        console.log("[CONTRACTOR REGISTRATION] Processing contractor registration for:", email);
        console.log("[CONTRACTOR REGISTRATION] Request body fields:", {
          companyName, streetAddress, city, province, country, postalCode,
          serviceRegions, supportedActivities, hasCodeOfConductAgreement,
          hasPrivacyPolicyAgreement, hasTermsOfServiceAgreement, hasDataSharingAgreement,
          acceptTerms, acceptBusinessInfo, acceptContact, codeOfConductAgreed, gstWcbInsuranceConfirmed
        });
        console.log("[CONTRACTOR REGISTRATION] Full request body:", req.body);
        
        // Validate required contractor fields (postalCode is optional for contractors)
        console.log("[CONTRACTOR REGISTRATION] Field validation debug:", {
          companyName: { value: companyName, valid: !!companyName },
          streetAddress: { value: streetAddress, valid: !!streetAddress },
          city: { value: city, valid: !!city },
          province: { value: province, valid: !!province },
          country: { value: country, valid: !!country },
          postalCode: { value: postalCode, valid: !!postalCode }
        });
        
        if (!companyName || !streetAddress || !city || !province || !country) {
          console.log("[CONTRACTOR REGISTRATION] Validation failed - one or more required fields missing");
          return res.status(400).json({ 
            message: "All business information fields are required for contractor registration" 
          });
        }

        // Validate contractor agreements - check both possible field name formats
        const codeOfConductAccepted = hasCodeOfConductAgreement || codeOfConductAgreed;
        const termsAccepted = hasTermsOfServiceAgreement || acceptTerms || agreeToPortalServices;
        const businessInfoAccepted = hasPrivacyPolicyAgreement || acceptBusinessInfo || agreeToBusinessInfo;
        const contactAccepted = hasDataSharingAgreement || acceptContact || agreeToContact;
        
        if (!codeOfConductAccepted || !termsAccepted || !businessInfoAccepted || !contactAccepted) {
          console.log("[CONTRACTOR REGISTRATION] Agreement validation failed:", {
            codeOfConductAccepted, termsAccepted, businessInfoAccepted, contactAccepted,
            receivedFields: { hasCodeOfConductAgreement, codeOfConductAgreed, acceptTerms, acceptBusinessInfo, acceptContact }
          });
          return res.status(400).json({ 
            message: "You must agree to all terms and conditions to register as a contractor" 
          });
        }

        // Generate unique short name for contractor company
        const baseShortName = companyName.substring(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '');
        let contractorShortName = baseShortName;
        let counter = 1;
        
        // Check for conflicts and generate unique name
        while (counter <= 100) {
          const existingCompany = await storage.getCompanyByShortName(contractorShortName);
          if (!existingCompany) {
            break; // Found unique name
          }
          
          counter++;
          // Generate new name with counter
          if (counter <= 9) {
            contractorShortName = `${baseShortName.substring(0, 5)}${counter}`;
          } else {
            contractorShortName = `${baseShortName.substring(0, 4)}${counter}`;
          }
        }
        
        if (counter > 100) {
          return res.status(400).json({ 
            message: "Unable to generate unique company identifier. Please contact support." 
          });
        }
        
        console.log(`[CONTRACTOR REGISTRATION] Generated unique short name: ${contractorShortName} for company: ${companyName}`);

        // Create contractor company
        const contractorCompany = await storage.createCompany({
          name: companyName,
          shortName: contractorShortName,
          businessNumber: businessNumber || null,
          website: website || companyWebsite || null,
          streetAddress,
          city,
          province,
          country,
          postalCode,
          phone: phone || null,
          isContractor: true,
          serviceRegions: serviceRegions || [],
          supportedActivities: supportedActivities || [],
          capitalRetrofitTechnologies: capitalRetrofitTechnologies || []
        });

        // Update user with contractor company association
        user = await storage.updateUser(user.id, {
          companyId: contractorCompany.id,
          role: "contractor_individual" as const
        });

        console.log(`[CONTRACTOR REGISTRATION] Created contractor company: ${contractorCompany.id} for user: ${user.id}`);
        
        // For contractors, set session to log them in immediately
        (req.session as any).userId = user.id;
        console.log(`[CONTRACTOR REGISTRATION] Set session for user: ${user.id}`);
        
        // Send confirmation email in background (not blocking)
        sendEmailVerificationEmail(email, firstName, emailVerificationToken).catch(error => {
          console.error(`[CONTRACTOR REGISTRATION] Failed to send confirmation email to ${email}:`, error);
        });
        
        console.log(`[CONTRACTOR REGISTRATION] Returning immediate login response for contractor`);
        return res.status(201).json({
          message: "Registration successful! Welcome to your contractor dashboard.",
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            companyId: user.companyId,
            twoFactorEnabled: user.twoFactorEnabled || false
          },
          requiresEmailVerification: false,
          redirectTo: "/contractor-dashboard"
        });
      }

      // If company owner, validate terms and create company
      if (isCompanyOwner) {

        
        // Check if user is email verified (either from session or database)
        if (!user.isEmailVerified) {
          return res.status(400).json({ 
            message: "Email verification is required for company owner registration" 
          });
        }

        // Validate required fields for company owners
        if (!companyName || !companyShortName || !businessNumber || 
            !streetAddress || !city || !province || !country || !postalCode || !howHeardAbout) {
          return res.status(400).json({ 
            message: "All business information fields are required for company owners" 
          });
        }

        // Validate terms and conditions
        if (!agreeToPortalServices || !agreeToBusinessInfo || !agreeToContact) {
          return res.status(400).json({ 
            message: "You must agree to all terms and conditions to register as a company owner" 
          });
        }

        // Check if company short name already exists
        const existingCompany = await storage.getCompanyByShortName(companyShortName);
        let finalShortName = companyShortName;
        
        if (existingCompany) {
          // Generate a unique short name by appending a number
          let counter = 2;
          do {
            finalShortName = `${companyShortName.substring(0, 5)}${counter}`;
            const checkCompany = await storage.getCompanyByShortName(finalShortName);
            if (!checkCompany) break;
            counter++;
          } while (counter < 100);
          
          if (counter >= 100) {
            return res.status(400).json({ 
              message: "Unable to generate unique company identifier. Please contact support." 
            });
          }
        }

        const company = await storage.createCompany({
          name: companyName,
          shortName: finalShortName,
          businessNumber,
          website: companyWebsite || null,
          streetAddress,
          city,
          province,
          country,
          postalCode,
          howHeardAbout,
          howHeardAboutOther: howHeardAbout === "other" ? howHeardAboutOther : null
        });

        // Update user with company association and verified status
        user = await storage.updateUser(user.id, {
          companyId: company.id,
          role: "company_admin" as const,
          isEmailVerified: true,
          emailVerifiedAt: new Date()
        });
      }

      // For company owners with verified emails, log them in immediately
      if (isCompanyOwner && user.isEmailVerified) {
        // Set session to log user in
        (req.session as any).userId = user.id;
        
        return res.status(201).json({
          message: "Registration successful! Welcome to your dashboard.",
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            companyId: user.companyId,
            twoFactorEnabled: user.twoFactorEnabled || false
          },
          requiresEmailVerification: false
        });
      }

      // Send verification email for non-verified users
      const emailSent = await sendEmailVerificationEmail(email, firstName, emailVerificationToken);
      
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send verification email. Please try again." });
      }

      res.status(201).json({
        message: "Registration successful! Please check your email for the verification code.",
        requiresEmailVerification: true,
        email: email,
        companyId: user.companyId
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Login endpoint (step 1: email/password verification)
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password, twoFactorToken } = req.body;
      console.log(`[LOGIN] Attempting login for email: ${email}`);

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        console.log(`[LOGIN] User not found or no password for email: ${email}`);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      console.log(`[LOGIN] User found: ${user.id}, role: ${user.role}, passwordLength: ${user.password?.length}`);

      try {
        const isValidPassword = await comparePasswords(password, user.password);
        console.log(`[LOGIN] Password validation result: ${isValidPassword}`);
        if (!isValidPassword) {
          return res.status(401).json({ message: "Invalid email or password" });
        }
      } catch (passwordError) {
        console.error(`[LOGIN] Password comparison error for ${email}:`, passwordError);
        return res.status(500).json({ message: "Failed to log in" });
      }

      // Check if email is verified
      if (!user.isEmailVerified) {
        return res.status(401).json({ 
          message: "Please verify your email address before logging in. Check your email for the verification link.",
          emailNotVerified: true
        });
      }

      // Check if 2FA is enabled for this user
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        // If 2FA token not provided, indicate 2FA is required
        if (!twoFactorToken) {
          return res.status(200).json({ 
            requiresTwoFactor: true,
            message: "Two-factor authentication required" 
          });
        }

        // Verify 2FA token
        const isValidToken = verifyTwoFactorToken(twoFactorToken, user.twoFactorSecret);
        if (!isValidToken) {
          return res.status(401).json({ message: "Invalid two-factor authentication code" });
        }
      }

      // Set session after successful authentication
      (req.session as any).userId = user.id;

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId,
        twoFactorEnabled: user.twoFactorEnabled
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to log in" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to log out" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  // Password reset request endpoint
  app.post("/api/auth/request-reset", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists for security
        return res.json({ message: "If an account exists, reset instructions have been sent" });
      }

      // Generate reset token and expiry
      const resetToken = nanoid(32);
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.updateUser(user.id, {
        resetToken,
        resetExpiry,
      });

      // Send password reset email
      const { sendPasswordResetEmail } = await import('./sendgrid');
      const emailSent = await sendPasswordResetEmail(email, resetToken);
      
      if (!emailSent) {
        console.error(`Failed to send reset email to ${email}`);
      } else {
        console.log(`Password reset email sent to: ${email}`);
      }
      
      res.json({ message: "If an account exists, reset instructions have been sent" });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ message: "Failed to process reset request" });
    }
  });

  // Password reset endpoint
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { email, newPassword } = req.body;

      // Validate password requirements
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,64}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ 
          message: "Password must be 8-64 characters with lowercase, uppercase, digit, and symbol" 
        });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user password
      await storage.updateUser(user.id, { password: hashedPassword });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Update profile endpoint
  app.patch("/api/auth/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      const { firstName, lastName } = req.body;

      if (!firstName?.trim() || !lastName?.trim()) {
        return res.status(400).json({ message: "First name and last name are required" });
      }

      const updatedUser = await storage.updateUser(userId, {
        firstName: firstName.trim(),
        lastName: lastName.trim()
      });

      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        permissionLevel: updatedUser.permissionLevel,
        companyId: updatedUser.companyId,
        profileImageUrl: updatedUser.profileImageUrl
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Get current user endpoint
  app.get("/api/auth/user", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissionLevel: user.permissionLevel,
        companyId: user.companyId,
        profileImageUrl: user.profileImageUrl,
        twoFactorEnabled: user.twoFactorEnabled
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Email verification code endpoint
  app.post("/api/auth/verify-code", async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;
      console.log(`[EMAIL VERIFICATION] Starting verification for email: ${email} with code: ${code}`);

      if (!email || !code) {
        console.log("[EMAIL VERIFICATION] Missing email or code");
        return res.status(400).json({ message: "Email and verification code are required" });
      }

      // Find user by email and verification token
      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log(`[EMAIL VERIFICATION] User not found for email: ${email}`);
        return res.status(400).json({ message: "User not found" });
      }

      console.log(`[EMAIL VERIFICATION] User found: ${user.id}, current verification status: ${user.isEmailVerified}`);
      console.log(`[EMAIL VERIFICATION] Expected token: ${user.emailVerificationToken}, provided code: ${code}`);

      if (user.isEmailVerified) {
        console.log("[EMAIL VERIFICATION] Email already verified");
        return res.status(400).json({ message: "Email is already verified" });
      }

      if (user.emailVerificationToken !== code) {
        console.log(`[EMAIL VERIFICATION] Invalid verification code. Expected: ${user.emailVerificationToken}, Got: ${code}`);
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Check if token has expired
      if (user.verificationTokenExpiry && new Date() > user.verificationTokenExpiry) {
        console.log("[EMAIL VERIFICATION] Verification code expired");
        return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
      }

      console.log("[EMAIL VERIFICATION] Updating user verification status");
      // Update user to mark email as verified and create session
      const updatedUser = await storage.updateUser(user.id, {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        verificationTokenExpiry: null
      });

      console.log(`[EMAIL VERIFICATION] User updated, new verification status: ${updatedUser.isEmailVerified}`);

      // Log the user in by creating a session
      (req.session as any).userId = user.id;

      // Get updated user data
      const verifiedUser = await storage.getUser(user.id);

      res.status(200).json({ 
        message: "Email verified successfully! Welcome to SEMI Program Portal.",
        user: verifiedUser,
        verified: true,
        redirectTo: verifiedUser?.role === "contractor_individual" ? "/contractor-dashboard" : "/"
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  // Email verification endpoint (legacy - for links)
  app.get("/api/auth/verify-email", async (req: Request, res: Response) => {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({ message: "Verification token is required" });
      }

      // Find user by verification token
      const user = await storage.getUserByVerificationToken(token as string);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }

      if (user.isEmailVerified) {
        return res.status(200).json({ message: "Email already verified" });
      }

      // Update user to mark email as verified
      await storage.updateUser(user.id, {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null
      });

      res.status(200).json({ 
        message: "Email successfully verified! You can now log in to your account.",
        verified: true
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  // Send verification code for registration (before user exists)
  app.post("/api/auth/send-registration-verification", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();


      
      // Store the verification code temporarily (in session or cache)
      (req.session as any).registrationVerification = {
        email,
        code: verificationCode,
        expires: Date.now() + 10 * 60 * 1000 // 10 minutes
      };

      // Send verification email
      const emailSent = await sendEmailVerificationEmail(email, "User", verificationCode);
      
      if (emailSent) {
        res.status(200).json({ message: "Verification code sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send verification email" });
      }
    } catch (error) {
      console.error("Send registration verification error:", error);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  // Verify registration code
  app.post("/api/auth/verify-registration-code", async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ message: "Email and verification code are required" });
      }

      const registrationData = (req.session as any)?.registrationVerification;
      
      if (!registrationData) {
        return res.status(400).json({ message: "No verification session found" });
      }

      if (registrationData.email !== email) {
        return res.status(400).json({ message: "Email does not match verification session" });
      }

      if (Date.now() > registrationData.expires) {
        return res.status(400).json({ message: "Verification code has expired" });
      }

      if (registrationData.code !== code) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Mark as verified in session
      (req.session as any).emailVerified = email;
      
      // Check if user already exists and update their verification status
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        await storage.updateUser(existingUser.id, {
          isEmailVerified: true,
          emailVerifiedAt: new Date()
        });

      }
      
      res.status(200).json({ message: "Email verified successfully" });
    } catch (error) {
      console.error("Verify registration code error:", error);
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  // Resend verification email
  app.post("/api/auth/resend-verification", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ message: "Email is already verified" });
      }

      // Generate new 6-digit verification code
      const emailVerificationToken = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await storage.updateUser(user.id, { 
        emailVerificationToken,
        verificationTokenExpiry 
      });

      // Send verification email
      const emailSent = await sendEmailVerificationEmail(email, user.firstName || "User", emailVerificationToken);
      
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send verification email" });
      }

      res.status(200).json({ 
        message: "Verification email sent! Please check your email.",
        emailSent: true
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  });

  // Generate 2FA setup (QR code and secret)
  app.post("/api/auth/2fa/setup", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      if (user.twoFactorEnabled) {
        return res.status(400).json({ message: "Two-factor authentication is already enabled" });
      }

      const twoFactorSetup = generateTwoFactorSecret(user.email);
      const qrCodeDataUrl = await generateQRCodeDataURL(twoFactorSetup.qrCodeUrl);

      res.json({
        secret: twoFactorSetup.secret,
        qrCode: qrCodeDataUrl,
        manualEntryKey: twoFactorSetup.manualEntryKey
      });
    } catch (error) {
      console.error("2FA setup error:", error);
      res.status(500).json({ message: "Failed to generate 2FA setup" });
    }
  });

  // Verify and enable 2FA
  app.post("/api/auth/2fa/verify", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { secret, token } = req.body;

      if (!secret || !token) {
        return res.status(400).json({ message: "Secret and token are required" });
      }

      const isValidToken = verifyTwoFactorToken(token, secret);
      if (!isValidToken) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Enable 2FA for the user
      await storage.updateUser(user.id, {
        twoFactorSecret: secret,
        twoFactorEnabled: true
      });

      res.json({ message: "Two-factor authentication enabled successfully" });
    } catch (error) {
      console.error("2FA verification error:", error);
      res.status(500).json({ message: "Failed to enable two-factor authentication" });
    }
  });

  // Disable 2FA
  app.post("/api/auth/2fa/disable", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { token } = req.body;

      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ message: "Two-factor authentication is not enabled" });
      }

      if (!token) {
        return res.status(400).json({ message: "Verification code is required" });
      }

      const isValidToken = verifyTwoFactorToken(token, user.twoFactorSecret);
      if (!isValidToken) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Disable 2FA for the user
      await storage.updateUser(user.id, {
        twoFactorSecret: null,
        twoFactorEnabled: false
      });

      res.json({ message: "Two-factor authentication disabled successfully" });
    } catch (error) {
      console.error("2FA disable error:", error);
      res.status(500).json({ message: "Failed to disable two-factor authentication" });
    }
  });
}

// Authentication middleware
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.session as any)?.userId;
    console.log('Auth middleware - userId from session:', userId, 'path:', req.path);
    
    if (!userId) {
      console.log('No userId in session');
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await storage.getUserById(userId);
    console.log('Auth middleware - user found:', user?.email, 'role:', user?.role);
    
    if (!user) {
      console.log('User not found in database');
      return res.status(401).json({ message: "User not found" });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};
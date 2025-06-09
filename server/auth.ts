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

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
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
      const { email, password, firstName, lastName, userType, companyName, companyShortName } = req.body;

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
      const userData = {
        id: userId,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        emailVerificationToken,
        verificationTokenExpiry,
        isEmailVerified: false,
        role: userType === "company_owner" ? "company_admin" as const : 
              userType === "contractor" ? "contractor_individual" as const : "team_member" as const
      };

      let user = await storage.upsertUser(userData);

      // If company owner, create company
      if (userType === "company_owner" && companyName && companyShortName) {
        const company = await storage.createCompany({
          name: companyName,
          shortName: companyShortName
        });

        // Update user with company association
        user = await storage.upsertUser({
          ...userData,
          companyId: company.id,
          role: "company_admin" as const
        });
      }

      // Send verification email
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

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isValidPassword = await comparePasswords(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
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

      if (!email || !code) {
        return res.status(400).json({ message: "Email and verification code are required" });
      }

      // Find user by email and verification token
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ message: "Email is already verified" });
      }

      if (user.emailVerificationToken !== code) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Check if token has expired
      if (user.verificationTokenExpiry && new Date() > user.verificationTokenExpiry) {
        return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
      }

      // Update user to mark email as verified and create session
      await storage.updateUser(user.id, {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        verificationTokenExpiry: null
      });

      // Log the user in by creating a session
      (req.session as any).userId = user.id;

      // Get updated user data
      const verifiedUser = await storage.getUser(user.id);

      res.status(200).json({ 
        message: "Email verified successfully! Welcome to SEMI Program Portal.",
        user: verifiedUser,
        verified: true
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
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};
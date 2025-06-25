import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await mailService.send({
      to: params.to,
      from: params.from || 'harsanjit.bhullar@enerva.ca',
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  
  return sendEmail({
    to: email,
    from: 'harsanjit.bhullar@enerva.ca',
    subject: 'SEMI Program - Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>You have requested to reset your password for the SEMI Program portal.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Reset Password</a>
        <p>If you did not request this password reset, please ignore this email.</p>
        <p>This link will expire in 1 hour for security reasons.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This email was sent from the SEMI Program Management System.<br>
          If you have any questions, please contact support.
        </p>
      </div>
    `,
    text: `
      You have requested to reset your password for the SEMI Program portal.
      
      Click the link below to reset your password:
      ${resetUrl}
      
      If you did not request this password reset, please ignore this email.
      This link will expire in 1 hour for security reasons.
    `
  });
}

interface SimpleTeamInvitationParams {
  to: string;
  html: string;
}

export async function sendTeamInvitationEmail(params: SimpleTeamInvitationParams): Promise<boolean> {
  return sendEmail({
    to: params.to,
    from: 'harsanjit.bhullar@enerva.ca',
    subject: 'Team Invitation - SEMI Program',
    html: params.html,
  });
}

interface OriginalTeamInvitationParams {
  to: string;
  invitedBy: string;
  invitedByEmail: string;
  company: string;
  firstName: string;
  lastName: string;
  role: string;
  tempPassword: string;
  customMessage?: string;
}

export async function sendOriginalTeamInvitationEmail(params: OriginalTeamInvitationParams): Promise<boolean> {
  const {
    to,
    invitedBy,
    invitedByEmail,
    company,
    firstName,
    lastName,
    role,
    tempPassword,
    customMessage
  } = params;

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
  const loginUrl = `${baseUrl}/auth`;
  
  const roleDisplayNames: Record<string, string> = {
    'company_admin': 'Company Administrator',
    'team_member': 'Team Member',
    'contractor_individual': 'Individual Contractor',
    'contractor_account_owner': 'Contractor Account Owner'
  };

  const roleDisplay = roleDisplayNames[role] || role;

  return sendEmail({
    to: to,
    from: 'harsanjit.bhullar@enerva.ca',
    subject: `Invitation to join ${company} - SEMI Program`,
    text: `
      Hi ${firstName},
      
      ${invitedBy} (${invitedByEmail}) has invited you to join ${company} in the SEMI Program as a ${roleDisplay}.
      
      ${customMessage ? `Personal message: ${customMessage}` : ''}
      
      Your temporary login credentials:
      Email: ${to}
      Temporary Password: ${tempPassword}
      
      Please log in at: ${loginUrl}
      
      You'll be prompted to change your password on first login.
      
      Welcome to the SEMI Program!
    `,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
        <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">SEMI Program</h1>
            <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 16px;">Sustainable Energy Management Initiative</p>
          </div>
          
          <h2 style="color: #333; margin-bottom: 20px;">You're Invited to Join ${company}!</h2>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 15px;">
            Hi <strong>${firstName}</strong>,
          </p>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 15px;">
            <strong>${invitedBy}</strong> (${invitedByEmail}) has invited you to join <strong>${company}</strong> in the SEMI Program as a <strong>${roleDisplay}</strong>.
          </p>
          
          ${customMessage ? `
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #374151; font-style: italic;">"${customMessage}"</p>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">- ${invitedBy}</p>
            </div>
          ` : ''}
          
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">Your Login Credentials</h3>
            <p style="margin: 5px 0; color: #92400e;"><strong>Email:</strong> ${to}</p>
            <p style="margin: 5px 0; color: #92400e;"><strong>Temporary Password:</strong> <code style="background-color: #fbbf24; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${tempPassword}</code></p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">Log In to SEMI Program</a>
          </div>
          
          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin: 25px 0;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              <strong>Important:</strong> You'll be prompted to change your password when you first log in. Please keep your login credentials secure.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              Welcome to the SEMI Program!<br>
              If you have any questions, please contact ${invitedByEmail}
            </p>
          </div>
        </div>
      </div>
    `
  });
}

export async function sendTeamMemberPendingEmail(email: string, firstName: string, companyName: string): Promise<boolean> {
  return sendEmail({
    to: email,
    from: 'harsanjit.bhullar@enerva.ca',
    subject: 'SEMI Program - Registration Submitted for Approval',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
          <h1 style="color: #333; margin-bottom: 30px; text-align: center;">Registration Submitted Successfully</h1>
          
          <div style="background-color: white; padding: 30px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #2563eb; margin-bottom: 20px;">What happens next?</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">
              Hi ${firstName},
            </p>
            <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">
              Your request to join <strong>${companyName}</strong> has been submitted to the SEMI Program Portal.
            </p>
            
            <div style="background-color: #dbeafe; border: 1px solid #3b82f6; border-radius: 6px; padding: 20px; margin: 25px 0;">
              <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">Next Steps:</h3>
              <ol style="color: #1e40af; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px;">Your registration is now pending approval from the company administrator of ${companyName}</li>
                <li style="margin-bottom: 10px;">You will receive an email notification once your request has been reviewed</li>
                <li style="margin-bottom: 10px;">Once approved, you'll be able to log in and access the portal with the permissions assigned to you</li>
              </ol>
            </div>
            
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin: 25px 0;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                <strong>Need assistance?</strong> If you have questions about your registration or need to contact your company administrator, please reach out to them directly or contact SEMI Program support.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              Thank you for your interest in the SEMI Program!
            </p>
          </div>
        </div>
      </div>
    `
  });
}

export async function sendEmailVerificationEmail(email: string, firstName: string, verificationCode: string): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
        <h1 style="color: #333; margin-bottom: 30px;">Verify Your Email Address</h1>
        
        <div style="background-color: white; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: left;">
          <h2 style="color: #2563eb; margin-bottom: 20px;">Welcome to SEMI Program Portal!</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">
            Hi ${firstName},
          </p>
          <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">
            Thank you for registering with the SEMI Program Portal. To complete your registration and access your account, 
            please enter the verification code below on the registration page.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; border: 2px dashed #2563eb;">
              <p style="margin: 0; font-size: 14px; color: #6b7280; margin-bottom: 10px;">Your verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; color: #2563eb; font-family: monospace; letter-spacing: 8px;">
                ${verificationCode}
              </div>
            </div>
          </div>
          
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              <strong>Important:</strong> This verification code will expire in 10 minutes. If you didn't create an account, please ignore this email.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            SEMI Program Portal - Strategic Energy Management Incentive Program<br>
            If you have any questions, please contact our support team.
          </p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail({
    to: email,
    from: "harsanjit.bhullar@enerva.ca",
    subject: "Your Verification Code - SEMI Program Portal",
    html: htmlContent,
    text: `Welcome to SEMI Program Portal! Your verification code is: ${verificationCode}. This code will expire in 10 minutes. Enter this code on the registration page to complete your account setup.`
  });
}

export async function sendContractorTeamInvitation(data: {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  inviterName: string;
  username: string;
  password: string;
  permissionLevel: string;
}): Promise<boolean> {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
  const loginUrl = `${baseUrl}/auth`;
  
  return sendEmail({
    to: data.email,
    from: 'harsanjit.bhullar@enerva.ca',
    subject: `Team Invitation - ${data.companyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
        <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">SEMI Program</h1>
            <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 16px;">Sustainable Energy Management Initiative</p>
          </div>
          
          <h2 style="color: #333; margin-bottom: 20px;">You've Been Invited to Join ${data.companyName}</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">
            Hello ${data.firstName},
          </p>
          <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">
            ${data.inviterName} has invited you to join their contracting team on the SEMI platform.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e9ecef;">
            <h3 style="color: #333; margin: 0 0 15px 0;">Your Login Credentials</h3>
            <p style="margin: 5px 0; color: #333;"><strong>Username:</strong> ${data.username}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Password:</strong> ${data.password}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Permission Level:</strong> ${data.permissionLevel}</p>
          </div>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #333; margin: 0 0 15px 0;">Your role includes:</h3>
            <ul style="color: #333; margin: 0; padding-left: 20px;">
              ${data.permissionLevel === 'viewer' ? '<li>View applications and company information</li>' : ''}
              ${data.permissionLevel === 'editor' ? '<li>Edit applications and company information</li><li>View team member details</li>' : ''}
              ${data.permissionLevel === 'manager' ? '<li>Full access including team management</li><li>Invite new team members</li><li>Manage permissions</li>' : ''}
            </ul>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;"><strong>Important:</strong> Please change your password after your first login for security.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">Login to SEMI Platform</a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              If you have any questions, please contact ${data.inviterName} or our support team.<br>
              Welcome to the SEMI Program!
            </p>
          </div>
        </div>
      </div>
    `
  });
}
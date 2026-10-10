// server/utils/brochureTemplates.js

const LOGO_URL = "https://res.cloudinary.com/da6jhcsmm/image/upload/v1772999280/logo_no_bg1_mfmk8x.png";

// ==========================================
// 1. THE CUSTOMER EMAIL (Authentic & Professional)
// ==========================================
const userBrochureTemplate = (name, plan_interest, customTrackingUrl) => {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-top: 6px solid #1765a4;">
      
      <div style="padding: 40px 40px 20px 40px; text-align: center;">
        <img src="${LOGO_URL}" alt="CuTe Learning" width="120" style="display: block; margin: 0 auto; width: 120px; height: auto;" />
      </div>

      <div style="padding: 0 40px 40px 40px;">
        <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 24px; font-weight: 700; letter-spacing: -0.5px;">
          Your guide to the ${plan_interest}
        </h1>
        
        <p style="color: #475569; font-size: 16px; line-height: 1.7; margin-bottom: 20px;">
          Hello ${name},
        </p>
        
        <p style="color: #475569; font-size: 16px; line-height: 1.7; margin-bottom: 30px;">
          Thank you for taking the time to explore a different path for your child's education. We have generated your secure, personalized access link for the <strong>${plan_interest}</strong> guide.
        </p>

        <div style="background-color: #f8fafc; border-left: 3px solid #ed7f23; padding: 24px; margin-bottom: 35px;">
          <p style="color: #0f172a; font-weight: 600; margin-top: 0; margin-bottom: 12px; font-size: 15px;">
            Inside this document, you won't find a rigid syllabus. Instead, we outline:
          </p>
          <ul style="color: #475569; font-size: 15px; line-height: 1.8; margin-bottom: 0; padding-left: 20px;">
            <li style="margin-bottom: 8px;">Our specific approach to nurturing genuine curiosity and independent learning.</li>
            <li style="margin-bottom: 8px;">Your vital role as a parent in supporting this shift without the anxiety of traditional expectations.</li>
            <li>The real academic, cognitive, and behavioral changes you will observe in your child over the coming years.</li>
          </ul>
        </div>

        <div style="text-align: left; margin-bottom: 40px;">
          <a href="${customTrackingUrl}" style="display: inline-block; background-color: #1765a4; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
            Access the Complete Guide &rarr;
          </a>
        </div>

        <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 30px;">
          If you have any questions after reading through the material, simply reply directly to this email. We are here to help you navigate this journey.
        </p>
        
        <p style="color: #475569; font-size: 15px; margin-bottom: 0;">
          Warm regards,<br>
          <strong>The CuTe Learning Team</strong>
        </p>
      </div>

      <div style="background-color: #1765a4; padding: 32px 40px; text-align: center;">
        <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 8px 0; letter-spacing: 0.5px;">
          Curious Team Learning Pvt. Ltd.
        </p>
        <p style="color: #e2e8f0; font-size: 14px; margin: 0 0 4px 0; line-height: 1.5;">
          You shouldn't have to trade your child's well-being to build their future.
        </p>
        <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 16px 0;">
          Let’s prioritize both, together.
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0 0; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px;">
          &copy; ${new Date().getFullYear()} Curious Team Learning. All rights reserved.
        </p>
      </div>
    </div>
  `;
};

// ==========================================
// 2. THE ADMIN NOTIFICATION (Clean CRM Style)
// ==========================================
const adminBrochureTemplate = (name, plan_interest, phone, whatsapp, email, isExistingUser, customTrackingUrl) => {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      
      <div style="background-color: #f8fafc; padding: 20px 30px; border-bottom: 1px solid #e2e8f0;">
        <h1 style="color: #0f172a; font-size: 18px; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
          <span style="color: #ed7f23;">•</span> New Program Inquiry
        </h1>
      </div>

      <div style="padding: 30px;">
        <p style="color: #475569; font-size: 15px; margin-bottom: 24px;">
          A user has requested access to the <strong>${plan_interest}</strong> guide.
        </p>

        <table style="width: 100%; color: #334155; font-size: 14px; border-collapse: collapse; margin-bottom: 30px;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; width: 35%; color: #64748b;">Name</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #64748b;">Email</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${email}" style="color: #1765a4; text-decoration: none;">${email}</a></td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #64748b;">Phone</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">${phone}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #64748b;">WhatsApp</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;"><a href="https://wa.me/${whatsapp.replace(/\D/g, "")}" style="color: #1765a4; text-decoration: none;">${whatsapp}</a></td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #64748b;">Existing User</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
              <span style="background-color: ${isExistingUser ? '#dcfce7' : '#f1f5f9'}; color: ${isExistingUser ? '#166534' : '#475569'}; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                ${isExistingUser ? "YES" : "NO"}
              </span>
            </td>
          </tr>
        </table>

        <div>
          <a href="${customTrackingUrl}" style="display: inline-block; color: #1765a4; font-weight: 600; font-size: 14px; text-decoration: underline;">
            View Generated Tracking Link
          </a>
        </div>
      </div>
    </div>
  `;
};

module.exports = { userBrochureTemplate, adminBrochureTemplate };
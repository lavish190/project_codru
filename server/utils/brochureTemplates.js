// server/utils/brochureTemplates.js

const LOGO_URL = "https://res.cloudinary.com/da6jhcsmm/image/upload/v1772999280/logo_no_bg1_mfmk8x.png";

// ==========================================
// 1. THE CUSTOMER EMAIL (Beautiful & Welcoming)
// ==========================================
const userBrochureTemplate = (name, plan_interest, customTrackingUrl) => {
  return `
    <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 20px auto; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #f1f5f9;">
      
      <div style="background-color: #ed7f23; padding: 40px 20px; text-align: center;">
        <img src="${LOGO_URL}" alt="Curious Team Learning" width="140" style="display: block; margin: 0 auto; width: 140px; height: auto;" />
      </div>

      <div style="padding: 40px; background-color: #ffffff; text-align: center;">
        <h1 style="color: #1765a4; font-size: 28px; margin-bottom: 12px; font-weight: 800;">Your Program Details Are Here! 🎓</h1>
        <p style="color: #64748b; font-size: 18px; line-height: 1.6; margin-bottom: 10px;">
          Hi <strong>${name}</strong>,
        </p>
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          Thank you for your interest in the <strong>${plan_interest}</strong> at Curious Team Learning! We have generated a secure link just for you.
        </p>

        <div style="text-align: left; background-color: #f8fafc; border-radius: 16px; padding: 25px; margin-bottom: 30px;">
          <p style="color: #1765a4; font-weight: bold; margin-top: 0; font-size: 16px;">Inside this brochure, you will find:</p>
          <ul style="color: #475569; font-size: 14px; line-height: 2; padding-left: 20px; margin-bottom: 0;">
            <li>📖 Comprehensive syllabus breakdown.</li>
            <li>🎯 Core benefits and learning outcomes.</li>
            <li>💬 How our mentors support your child's journey.</li>
          </ul>
        </div>

        <a href="${customTrackingUrl}" style="display: inline-block; background-color: #ed7f23; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(237, 127, 35, 0.2);">
          View Program Brochure
        </a>

        <p style="color: #94a3b8; font-size: 13px; margin-top: 40px;">
          If you have any immediate questions, simply reply to this email to talk to our team!
        </p>
      </div>

      <div style="background-color: #f1f5f9; padding: 30px; text-align: center;">
        <p style="color: #1765a4; font-size: 15px; font-weight: bold; margin: 0 0 5px 0;">Curious Team Learning</p>
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          Every child learns their way... We teach that way.<br>
          &copy; ${new Date().getFullYear()} Curious Team. All rights reserved.
        </p>
      </div>
    </div>
  `;
};

// ==========================================
// 2. THE ADMIN NOTIFICATION (Clean & Data-Focused)
// ==========================================
const adminBrochureTemplate = (name, plan_interest, phone, whatsapp, email, isExistingUser, customTrackingUrl) => {
  return `
    <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 20px auto; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #f1f5f9;">
      
      <div style="background-color: #1765a4; padding: 30px 20px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 800;">🔥 New Hot Lead Alert!</h1>
      </div>

      <div style="padding: 40px; background-color: #ffffff;">
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 25px; text-align: center;">
          A new user has just requested the brochure for the <strong>${plan_interest}</strong>.
        </p>

        <div style="background-color: #f8fafc; border-radius: 16px; padding: 25px; margin-bottom: 30px; border-left: 4px solid #ed7f23;">
          <table style="width: 100%; color: #475569; font-size: 15px; border-collapse: separate; border-spacing: 0 12px;">
            <tr>
              <td style="font-weight: bold; width: 40%; color: #1765a4;">Name:</td>
              <td>${name}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; color: #1765a4;">Email:</td>
              <td><a href="mailto:${email}" style="color: #ed7f23; text-decoration: none;">${email}</a></td>
            </tr>
            <tr>
              <td style="font-weight: bold; color: #1765a4;">Phone:</td>
              <td>${phone}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; color: #1765a4;">WhatsApp:</td>
              <td><a href="https://wa.me/${whatsapp.replace(/\D/g, "")}" style="color: #ed7f23; text-decoration: none;">${whatsapp}</a></td>
            </tr>
            <tr>
              <td style="font-weight: bold; color: #1765a4;">Existing User:</td>
              <td><strong style="color: ${isExistingUser ? '#10b981' : '#f43f5e'};">${isExistingUser ? "YES ✅" : "NO ❌"}</strong></td>
            </tr>
          </table>
        </div>

        <div style="text-align: center;">
          <a href="${customTrackingUrl}" style="display: inline-block; background-color: #f1f5f9; color: #1765a4; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; border: 1px solid #cbd5e1;">
            View Their Custom Tracking Link
          </a>
        </div>
      </div>
    </div>
  `;
};

module.exports = { userBrochureTemplate, adminBrochureTemplate };
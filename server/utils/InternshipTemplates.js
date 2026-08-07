const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

// ==========================================
// SHARED EMAIL BRANDING (Header & Footer)
// ==========================================
const LOGO_URL = "https://res.cloudinary.com/da6jhcsmm/image/upload/v1772999280/logo_no_bg1_mfmk8x.png";

const emailHeader = () => `
  <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 20px auto; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #f1f5f9;">
    <div style="background-color: #ed7f23; padding: 40px 20px; text-align: center;">
      <img src="${LOGO_URL}" alt="Curious Team Learning" width="140" style="display: block; margin: 0 auto; width: 140px; height: auto;" />
    </div>
    <div style="padding: 40px; background-color: #ffffff; text-align: center;">
`;

const emailFooter = () => `
    </div>
    <div style="background-color: #f1f5f9; padding: 30px; text-align: center;">
      <p style="color: #1765a4; font-size: 15px; font-weight: bold; margin: 0 0 5px 0;">Curious Team Learning</p>
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        Empowering education with empathy.<br>
        &copy; 2026 Curious Team. All rights reserved.
      </p>
    </div>
  </div>
`;

// ==========================================
// 1. APPROVAL / OFFER LETTER EMAIL TEMPLATE
// ==========================================
const approvalEmailTemplate = (name, topic, type) => {
  return `
    ${emailHeader()}
      <h1 style="color: #1765a4; font-size: 28px; margin-bottom: 12px; font-weight: 800;">Application Approved! 🎉</h1>
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 10px;">
        Hi <strong>${name}</strong>,
      </p>
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
        We are thrilled to inform you that you have been selected for the <strong>${type}</strong> role in ${topic}.
      </p>

      <div style="text-align: left; background-color: #f8fafc; border-radius: 16px; padding: 25px; margin-bottom: 30px;">
        <p style="color: #1765a4; font-weight: bold; margin-top: 0; font-size: 16px;">What's next?</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Your official Offer Letter is attached to this email. Please review the document carefully for your schedule and further instructions regarding your onboarding process.
        </p>
      </div>

      <p style="color: #94a3b8; font-size: 14px; margin-top: 20px;">
        Welcome to the team. We look forward to working with you!
      </p>
    ${emailFooter()}
  `;
};

// ==========================================
// 2. REJECTION EMAIL TEMPLATE
// ==========================================
const rejectionEmailTemplate = (name, topic, reason) => {
  const reasonText = reason && reason.trim() !== ""
    ? `<div style="text-align: left; margin: 20px 0; padding: 20px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; color: #7f1d1d; font-size: 14px; line-height: 1.6;"><strong>Feedback on your application:</strong><br/>${reason}</div>`
    : `<p style="color: #64748b; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">We receive many highly qualified applications, and this was a difficult decision. We encourage you to continue developing your skills and invite you to re-apply in the future.</p>`;

  return `
    ${emailHeader()}
      <h1 style="color: #1765a4; font-size: 24px; margin-bottom: 12px; font-weight: 800;">Application Update</h1>
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 10px;">
        Hi <strong>${name}</strong>,
      </p>
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        Thank you for applying for the <strong>${topic}</strong> program. After careful review of your profile, we regret to inform you that we are unable to move forward with your application at this time.
      </p>
      ${reasonText}
      <p style="color: #94a3b8; font-size: 14px; margin-top: 30px;">
        We wish you the absolute best in your future endeavors.
      </p>
    ${emailFooter()}
  `;
};

// ==========================================
// 3. COMPLETION EMAIL TEMPLATE
// ==========================================
const completionEmailTemplate = (app) => {
  const name = app.personalDetails.name;
  const topic = app.programDetails.topic;
  const type = app.programDetails.type || "Internship";
  const duration = app.programDetails.durationDays;
  const startDate = dayjs(app.programDetails.startDate).format("DD MMM YYYY");
  const endDate = dayjs(app.programDetails.endDate).format("DD MMM YYYY");
  const displayType = type.charAt(0).toUpperCase() + type.slice(1);

  return `
    ${emailHeader()}
      <h1 style="color: #1765a4; font-size: 28px; margin-bottom: 12px; font-weight: 800;">Certificate Issued! 🏆</h1>
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 10px;">
        Hi <strong>${name}</strong>,
      </p>
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
        Congratulations on successfully completing your <strong>${duration}-day ${topic} ${displayType}</strong> with Curious Team Learning, from ${startDate} to ${endDate}.
      </p>

      <div style="text-align: left; background-color: #f8fafc; border-radius: 16px; padding: 25px; margin-bottom: 30px;">
        <p style="color: #1765a4; font-weight: bold; margin-top: 0; font-size: 16px;">Your Certificate is Attached</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          We are delighted to present you with your official certificate. This document acknowledges your commitment and dedication towards learning and the skills you have developed.
        </p>
      </div>

      <p style="color: #94a3b8; font-size: 14px; margin-top: 20px;">
        It was a pleasure learning with you. We hope you have a bright and successful career ahead!
      </p>
    ${emailFooter()}
  `;
};

// Helper to fetch images and convert to Base64 for pdfmake
const fetchImageBase64 = async (url) => {
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'image/png, image/*;q=0.8' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    return 'data:image/png;base64,' + Buffer.from(buffer).toString('base64');
  } catch (err) {
    console.error(`🚨 Image fetch error for [${url}]:`, err.message);
    throw err; 
  }
};

// ==========================================
// 4. GENERATE OFFER LETTER PDF (pdfmake)
// ==========================================
const generateOfferLetterPdf = async (app) => {
  const name = app.personalDetails.name;
  const type = app.programDetails.type || "Internship"; 
  const duration = app.programDetails.durationDays;
  const startDate = dayjs(app.programDetails.startDate).tz("Asia/Kolkata").format("DD MMMM YYYY");
  const endDate = dayjs(app.programDetails.endDate).tz("Asia/Kolkata").format("DD MMMM YYYY");
  const topic = app.programDetails.topic; 
  const mode = app.programDetails.mode || "Remote"; 
  const currentDate = app.programDetails.offerLetterDate 
    ? dayjs(app.programDetails.offerLetterDate).tz("Asia/Kolkata").format("DD-MM-YY")
    : dayjs().tz("Asia/Kolkata").format("DD-MM-YY");

  const locationText = mode === "On-site"
    ? `Your place of ${type} that will resume from ${startDate} to ${endDate}, shall be on-site at our office located at Shop No.: 1, 2 R. K. Puram, Sector A, Kota. - 324010 during this duration.`
    : `Your place of ${type} that will resume from ${startDate} to ${endDate}, shall be work from home during this duration.`;

  const headerImg = await fetchImageBase64('https://res.cloudinary.com/da6jhcsmm/image/upload/v1785307787/LetterheadHeader_bimktp.png');
  const logoImg = await fetchImageBase64('https://res.cloudinary.com/da6jhcsmm/image/upload/v1786068500/Artboard_1_vkzie7.png');
  const footerImg = await fetchImageBase64('https://res.cloudinary.com/da6jhcsmm/image/upload/v1785328050/LetterheadFooter_obokot.png'); 
  const sealSignImg = await fetchImageBase64('https://res.cloudinary.com/da6jhcsmm/image/upload/v1785328609/sealSign_cq3uik.png');

  return {
    pageSize: 'A4',
    pageMargins: [50, 110, 50, 100], 
    
    background: [
      { image: headerImg, width: 615, absolutePosition: { x: -10, y: -5 } },
      { image: logoImg, width: 300, opacity: 0.08, absolutePosition: { x: 147, y: 270 } },
      { image: footerImg, width: 615, absolutePosition: { x: -10, y: 770 } }
    ],

    content: [
      // 🚨 ADDED font property here!
      { text: 'Offer Letter', font: 'ArialRoundedMTBold', fontSize: 18, alignment: 'center', margin: [0, 0, 0, 40], decoration: 'underline' },
      
      { text: `Date: ${currentDate}`, fontSize: 12, margin: [0, 0, 0, 5] },
      { text: `Name: ${name}`, fontSize: 12, bold: true, margin: [0, 0, 0, 5] },
      { text: `Subject: Offer Letter for ${duration} days of ${type}`, fontSize: 12, bold: true, margin: [0, 0, 0, 20] },
      
      { text: `Dear ${name},`, fontSize: 12, margin: [0, 0, 0, 10] },
      { text: `We are pleased to inform you that you have been selected for ${type} at Curious Team Learning Pvt. Ltd.`, fontSize: 12, lineHeight: 1.5, margin: [0, 0, 0, 10] },
      
      { text: locationText, fontSize: 12, lineHeight: 1.5, margin: [0, 0, 0, 10] },
      
      { text: `You are required to work on the ${topic} for Curious Team Learning on the date stated above and shall soon receive the other instructions in successive communication.`, fontSize: 12, lineHeight: 1.5, margin: [0, 0, 0, 10] },
      { text: `A certificate shall be issued to you on successful completion of the ${type}. The duration shall be ${duration} days on the above-mentioned dates.`, fontSize: 12, lineHeight: 1.5, margin: [0, 0, 0, 10] },
      { text: `We are looking forward to you working with us. Please do not hesitate to call us for any information you may need.`, fontSize: 12, lineHeight: 1.5, margin: [0, 0, 0, 20] },
      
      { text: 'Congratulations!', fontSize: 12, bold: true, margin: [0, 0, 0, 20] },
      { text: 'Sincerely,', fontSize: 12, margin: [0, 0, 0, 10] },
      
      { 
        image: sealSignImg, 
        width: 110, 
        margin: [0, 0, 0, 10] 
      },

      { text: 'Disha Audichya', fontSize: 12, bold: true, margin: [0, 0, 0, 4] },
      { text: 'Director & CEO', fontSize: 12, margin: [0, 0, 0, 10] }
    ],
    defaultStyle: { font: 'Inter' }
  };
};

// ==========================================
// 5. GENERATE CERTIFICATE PDF
// ==========================================
const generateCertificatePdf = async (app) => { 
  const name = app.personalDetails.name;
  const topic = app.programDetails.topic;
  const type = app.programDetails.type || "internship"; 
  const randomAngle = Math.floor(Math.random() * 91) - 45;
  const isTraining = type.toLowerCase() === 'training';
  const displayType = isTraining ? 'Training' : 'Internship';
  const startDate = dayjs(app.programDetails.startDate).tz("Asia/Kolkata").format("D MMM. YYYY");
  const endDate = dayjs(app.programDetails.endDate).tz("Asia/Kolkata").format("D MMM. YYYY");
  const barcodeStr = app.completionDetails?.barcodeStr || "N/A";

  const backgroundImageUrl = isTraining 
    ? 'https://res.cloudinary.com/da6jhcsmm/image/upload/v1786103452/Blank_Training_Certificate_x9tiau.png' 
    : 'https://res.cloudinary.com/da6jhcsmm/image/upload/v1786103452/Blank_Internship_Certificate_byu1cb.png';
    
  const bgImg = await fetchImageBase64(backgroundImageUrl);
  const stampUrl = `https://res.cloudinary.com/da6jhcsmm/image/upload/a_${randomAngle}/v1785305674/Stamp_iqy2pk.png`;
  const stampImg = await fetchImageBase64(stampUrl);
  
  const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${barcodeStr}&rotate=R&scale=2&includetext=true`;
  const barcodeImg = await fetchImageBase64(barcodeUrl);

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [0, 0, 0, 0],

    background: [
      { image: bgImg, width: 841.89, height: 595.28 }
    ],

    content: [
      { 
        text: name, 
        font: 'SegoePrint', 
        fontSize: 32, 
        color: '#1f2937', 
        absolutePosition: { x: 184, y: 252 } 
      },
      
      {
        text: [
          { text: `has successfully completed ${topic} ${displayType} at\n`, bold: true },
          { text: `Curious Team Learning Pvt. Ltd. dated ${startDate} to ${endDate}\n`, bold: true },
          { text: 'and now possesses necessary skills and knowledge required for the field.', bold: true }
        ],
        fontSize: 13, 
        lineHeight: 1.6, 
        color: '#334155', 
        absolutePosition: { x: 184, y: 332 }
      },
      
      { 
        image: stampImg, 
        width: 102, 
        absolutePosition: { x: 368, y: 440 } 
      },
      
      { 
        image: barcodeImg, 
        width: 28, 
        absolutePosition: { x: 795, y: 110 } 
      }
    ],
    defaultStyle: { font: 'Inter' }
  };
};

module.exports = {
  approvalEmailTemplate,
  rejectionEmailTemplate,
  completionEmailTemplate,
  generateOfferLetterPdf,
  generateCertificatePdf
};
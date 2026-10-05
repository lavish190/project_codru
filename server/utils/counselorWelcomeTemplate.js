const counselorWelcomeTemplate = (name) => {
    return `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1765a4; margin: 0;">Welcome to the Admissions Team! 🎉</h2>
        </div>
        
        <p style="color: #555; font-size: 16px;">Hi <b>${name}</b>,</p>
        <p style="color: #555; font-size: 16px; line-height: 1.5;">
          The Admin team has just granted you <b>Counselor privileges</b> on the CuTe Learning platform.
        </p>
        
        <div style="background-color: #fdf8f4; border-left: 4px solid #ed7f23; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: #555; font-size: 15px;">
            <strong>Next Step:</strong> Please log in to your dashboard and navigate to the <b>My Schedule</b> tab. 
            You will need to set your local timezone and define the days/hours you are available to take Discovery Calls with parents.
          </p>
        </div>
        
        <p style="color: #777; font-size: 14px;">If you have any questions, please reach out to the Admin team.</p>
      </div>
    `;
  };
  
  module.exports = counselorWelcomeTemplate;
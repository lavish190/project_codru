import express from "express";
import nodemailer from "nodemailer";

const app = express();

app.use(express.json());

app.post("/send", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (authHeader !== `Bearer ${process.env.MICROSERVICE_SECRET}`) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  const { mailOptions } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
      }
    });

    const info = await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      info
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Failed to send email"
    });
  }
});

app.listen(5001, () => {
  console.log("Mail service running on port 5001");
});
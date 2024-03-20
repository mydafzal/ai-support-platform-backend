const nodemailer = require("nodemailer");

async function sendEmail(email, emailLink) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.NODE_MAILER_EMAIL,
      pass: process.env.NODE_MAILER_APP_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.NODE_MAILER_EMAIL,
    to: email,
    subject: "Verify Your Email",
    html: `Click the link to verify your email: <a href="${emailLink}">${emailLink}</a>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}

module.exports = { sendEmail };

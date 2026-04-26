import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Resend } from "resend";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes
  app.post("/api/notify", async (req, res) => {
    const { email, eventTitle, eventDate, eventLocation } = req.body;

    if (!resend) {
      return res.status(500).json({ error: "Resend API key not configured" });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: "Inviscan <your-email@example.com>",
        to: [email],
        subject: `Reminder: ${eventTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #6366f1;">Event Reminder</h2>
            <p>Hi there,</p>
            <p>This is a reminder for your upcoming event:</p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">${eventTitle}</h3>
              <p><strong>Date:</strong> ${new Date(eventDate).toLocaleString()}</p>
              <p><strong>Location:</strong> ${eventLocation}</p>
            </div>
            <p>Don't forget to be there!</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #6b7280;">Sent via Event Scanner App</p>
          </div>
        `,
      });

      if (error) {
        console.error("Resend error:", error);
        return res.status(400).json({ error });
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error("Failed to send notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

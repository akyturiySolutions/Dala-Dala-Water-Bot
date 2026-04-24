console.log("FIREBASE_CONFIG:", 
process.env.FIREBASE_CONFIG);
require("dotenv").config();
const fetch   = require("node-fetch");
const express = require("express");


// ─────────────────────────────────────────────
// 🔥 FIREBASE ADMIN INIT
// ─────────────────────────────────────────────
const admin   = require("./firebase");
if (!admin.app.length){
const serviceAccount = 
JSON.parse(process.env.FIREBASE_CONFIG);

}

const db = admin.firestore();

// ─────────────────────────────────────────────
const app = express();
app.use(express.json());

// ─────────────────────────────────────────────
// 💧 PRODUCT CATALOG
// ─────────────────────────────────────────────
const PRODUCTS = [
  { id: 1,  name: "300ml (1x24) DALA",                      price: 456.00  },
  { id: 2,  name: "500ml (1x12) DALA",                      price: 324.00  },
  { id: 3,  name: "500ml (1x24) DALA",                      price: 653.40  },
  { id: 4,  name: "1.0 Litre (1x12) DALA",                  price: 576.00  },
  { id: 5,  name: "1.5 Litres (1x12) DALA",                 price: 780.00  },
  { id: 6,  name: "5 Litres (1x4) Handle DALA",             price: 760.00  },
  { id: 7,  name: "10 Litres (1x1) Handle DALA",            price: 270.00  },
  { id: 8,  name: "10 Litres (1x1) Dispenser Disposable",   price: 275.00  },
  { id: 9,  name: "18 Litres (1x1) Dispenser Disposable",   price: 490.00  },
];

const MENU_TEXT = PRODUCTS.map(
  (p) => `  *${p.id}.* ${p.name} — KES ${p.price.toFixed(2)}`
).join("\n");

// ─────────────────────────────────────────────
// 💬 MESSAGE HELPERS
// ─────────────────────────────────────────────
function welcomeMessage() {
  return (
    `💧 *Welcome to Dala Dala Water!*\n` +
    `Fresh spring water delivered to your door.\n\n` +
    `Please choose an option:\n` +
    `  *1* — 🛒 Order water\n` +
    `  *2* — 📋 View our products\n` +
    `  *3* — 📞 Contact us\n\n` +
    `Reply with a number to continue.`
  );
}

function productMenuMessage() {
  return (
    `🛒 *Choose your product:*\n\n` +
    MENU_TEXT +
    `\n\nReply with the product *number* (1–${PRODUCTS.length}).`
  );
}

function isGreeting(text) {
  const greetings = [
    "hi", "hello", "hey", "helo", "hii", "start", "menu",
    "habari", "mambo", "niaje", "sasa", "karibu", "water",
    "order", "dala", "maji", "0", "restart", "back"
  ];
  return greetings.some((g) => text.includes(g));
}

// ─────────────────────────────────────────────
// 💾 SAVE ORDER TO FIRESTORE
// ─────────────────────────────────────────────
async function saveOrder(user, phone) {
  try {
    const orderRef = await db.collection("orders").add({
      phone:     phone,
      product:   user.product.name,
      quantity:  user.quantity,
      total:     user.total,
      location:  user.location,
      status:    "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Order saved to Firestore: ${orderRef.id}`);
    return orderRef.id;
  } catch (err) {
    console.error("❌ Firestore save error:", err);
    return null;
  }
}

// ─────────────────────────────────────────────
// 🔹 WEBHOOK VERIFICATION
// ─────────────────────────────────────────────
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ─────────────────────────────────────────────
// 🔹 RECEIVE MESSAGES
// ─────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (
      body.object &&
      body.entry?.[0]?.changes?.[0]?.value?.messages
    ) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from    = message.from;
      const text    = (message?.text?.body?.trim().toLowerCase()) || "";

      console.log(`📩 From: ${from}  |  Text: "${text}"`);

      // Session init
      if (!global.sessions)       global.sessions = {};
      if (!global.sessions[from]) global.sessions[from] = { step: "start" };

      const user = global.sessions[from];
      let reply  = "";

      // ── STEP: start ─────────────────────────────────────────────────
      if (user.step === "start" || isGreeting(text)) {
        user.step = "main_menu";
        reply = welcomeMessage();
      }

      // ── STEP: main_menu ─────────────────────────────────────────────
      else if (user.step === "main_menu") {
        if (text === "1") {
          user.step = "select_product";
          reply = productMenuMessage();
        } else if (text === "2") {
          reply =
            `📋 *Dala Dala Water — Full Product List*\n\n` +
            MENU_TEXT +
            `\n\nType *1* to place an order, or *menu* to go back.`;
        } else if (text === "3") {
          reply =
            `📞 *Contact Dala Dala Water*\n\n` +
            `WhatsApp / Call: +254 700 000000\n` +
            `Delivery area: Mombasa County\n\n` +
            `Type *menu* to go back.`;
        } else {
          reply =
            `⚠️ Please reply with *1*, *2*, or *3*.\n\n` + welcomeMessage();
        }
      }

      // ── STEP: select_product ────────────────────────────────────────
      else if (user.step === "select_product") {
        const choice  = parseInt(text);
        const product = PRODUCTS.find((p) => p.id === choice);

        if (product) {
          user.product = product;
          user.step    = "select_quantity";
          reply =
            `✅ You selected:\n*${product.name}*\n` +
            `Price: KES ${product.price.toFixed(2)} per pack\n\n` +
            `How many packs do you want? (Reply with a number)`;
        } else {
          reply =
            `❌ Invalid choice. Please reply with a number from 1 to ${PRODUCTS.length}.\n\n` +
            productMenuMessage();
        }
      }

      // ── STEP: select_quantity ───────────────────────────────────────
      else if (user.step === "select_quantity") {
        const qty = parseInt(text);

        if (!isNaN(qty) && qty > 0) {
          user.quantity = qty;
          user.total    = qty * user.product.price;
          user.step     = "confirm";

          reply =
            `🧾 *Order Summary*\n` +
            `────────────────────\n` +
            `🧴 ${user.product.name}\n` +
            `📦 Quantity : ${qty} pack(s)\n` +
            `💰 Total    : KES ${user.total.toFixed(2)}\n` +
            `────────────────────\n\n` +
            `Reply *yes* to confirm, or *no* to cancel.`;
        } else {
          reply = `❌ Please enter a valid number (e.g. *2*).`;
        }
      }

      // ── STEP: confirm ───────────────────────────────────────────────
      else if (user.step === "confirm") {
        if (text === "yes") {
          user.step = "get_location";
          reply =
            `📍 Please share your *delivery location* or area in Mombasa County.\n` +
            `(e.g. "Nyali", "Bamburi", "Tudor")`;
        } else if (text === "no") {
          user.step = "main_menu";
          reply = `❌ Order cancelled.\n\n` + welcomeMessage();
        } else {
          reply = `Please reply *yes* to confirm or *no* to cancel.`;
        }
      }

      // ── STEP: get_location ──────────────────────────────────────────
      else if (user.step === "get_location") {
        user.location = text;

        // 💾 Save to Firestore
        const orderId = await saveOrder(user, from);

        user.step = "await_mpesa";

        reply =
          `✅ *Order Placed Successfully!*\n\n` +
          `🧴 ${user.product.name}\n` +
          `📦 ${user.quantity} pack(s)\n` +
          `💰 KES ${user.total.toFixed(2)}\n` +
          `📍 ${user.location}\n` +
          (orderId ? `🆔 Order ID: ${orderId}\n` : "") +
          `\n💳 *Payment: M-Pesa Buy Goods*\n` +
          `   Till Number: *6247361*\n` +
          `   Amount: KES ${user.total.toFixed(2)}\n\n` +
          `After payment, send your *M-Pesa confirmation code* here.\n` +
          `Our team will confirm and dispatch your order. 🚚`;
      }

      // ── STEP: await_mpesa — customer sends Mpesa code ───────────────
      else if (user.step === "await_mpesa") {
        // Store mpesa code against their last order (optional enhancement)
        console.log(`💳 Mpesa code from ${from}: ${text}`);

        reply =
          `✅ *Payment code received!*\n` +
          `We'll verify and dispatch your order shortly. 🚚\n\n` +
          `Type *menu* to place another order.`;

        global.sessions[from] = { step: "start" };
      }

      // ── FALLBACK ────────────────────────────────────────────────────
      else {
        user.step = "main_menu";
        reply = `🤔 Not sure what you mean. Let's start over:\n\n` + welcomeMessage();
      }

      // ── SEND REPLY ──────────────────────────────────────────────────
      console.log(`💬 Reply to ${from}: ${reply.substring(0, 80)}...`);

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            text: { body: reply },
          }),
        }
      );

      const data = await response.json();
      if (data.error) console.error("❌ Meta error:", data.error);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Server error:", error);
    res.sendStatus(500);
  }
});

// ─────────────────────────────────────────────
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Dala Dala Water bot running on port", process.env.PORT || 3000);
});

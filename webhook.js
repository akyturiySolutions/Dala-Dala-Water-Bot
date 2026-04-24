const express = require('express');
const axios = require('axios');
const db = require('./firebase');
const router = express.Router();

const userState = {};

const products = {
  "1": { name: "300ml (24pcs)", price: 456 },
  "2": { name: "500ml (12pcs)", price: 324 },
  "3": { name: "500ml (24pcs)", price: 653 },
  "4": { name: "1L (12pcs)", price: 576 },
  "5": { name: "1.5L (12pcs)", price: 780 },
  "6": { name: "5L (4pcs)", price: 760 },
  "7": { name: "10L", price: 275 },
  "8": { name: "18.9L", price: 490 }
};

router.get('/', (req, res) => {
  res.send("Webhook live");
});

router.post('/', async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body?.toLowerCase();

    console.log("Incoming:", text);

    let reply = "";
    const state = userState[from] || {};

    if (text === "hi" || text === "menu") {
      reply = `💧 Dala Dala Water

1. 300ml (24pcs) - 456
2. 500ml (12pcs) - 324
3. 500ml (24pcs) - 653
4. 1L (12pcs) - 576
5. 1.5L (12pcs) - 780
6. 5L (4pcs) - 760
7. 10L - 275
8. 18.9L - 490

Reply with number`;

      userState[from] = {};
    }

    else if (products[text]) {
      userState[from] = {
        step: "quantity",
        product: products[text]
      };

      reply = `Selected: ${products[text].name}
Price: KES ${products[text].price}

Enter quantity:`;
    }

    else if (state.step === "quantity") {
      const qty = parseInt(text);
      const total = state.product.price * qty;

      userState[from] = {
        ...state,
        step: "location",
        quantity: qty,
        total: total
      };

      reply = `Total: KES ${total}

Enter delivery location 📍`;
    }

    else if (state.step === "location") {
      userState[from] = {
        ...state,
        step: "confirm",
        location: text
      };

      reply = `🧾 Order Summary
${state.product.name}
Qty: ${state.quantity}
Total: KES ${state.total}
Location: ${text}

Confirm? (yes/no)`;
    }

    else if (state.step === "confirm") {
      if (text === "yes") {

        await db.collection("orders").add({
          phone: from,
          product: state.product.name,
          price: state.product.price,
          quantity: state.quantity,
          total: state.total,
          location: state.location,
          status: "pending",
          createdAt: new Date()
        });

        reply = "✅ Order received! We will deliver shortly 🚚💧";

        userState[from] = {};
      } else {
        reply = "❌ Order cancelled. Type Hi to restart.";
        userState[from] = {};
      }
    }

    else {
      reply = "Type Hi to start ordering 💧";
    }

    console.log("Reply:", reply);

    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: { body: reply }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

module.exports = router;

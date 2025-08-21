router.post("/:id", async (req, res) => {
  const { text } = req.body;
  const message = await Message.create({
    sender: req.user.id,
    receiver: req.params.id,
    text
  });
  res.json(message);
});

router.get("/:id", async (req, res) => {
  const msgs = await Message.find({
    $or: [
      { sender: req.user.id, receiver: req.params.id },
      { sender: req.params.id, receiver: req.user.id }
    ]
  }).sort("createdAt");
  res.json(msgs);
});
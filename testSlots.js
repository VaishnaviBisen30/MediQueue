const generateSlots = require("./utils/slotGenerator");

const slots = generateSlots(
    "09:00",
    "17:00",
    "13:00",
    "14:00"
);

console.log(slots);
import { ProductInsert } from "@/db/schema";

export const createProducts = (): ProductInsert[] => {
  const d = 24 * 60 * 60 * 1000;
  return [
    {
      leadTime: 15,
      available: 30,
      type: "NORMAL",
      name: "USB Cable",
    },
    {
      leadTime: 10,
      available: 0,
      type: "NORMAL",
      name: "USB Dongle",
    },
    {
      leadTime: 15,
      available: 30,
      type: "EXPIRABLE",
      name: "Butter",
      expiryDate: new Date(Date.now() + 26 * d),
    },
    {
      leadTime: 90,
      available: 6,
      type: "EXPIRABLE",
      name: "Milk",
      expiryDate: new Date(Date.now() - 2 * d),
    },
    {
      leadTime: 15,
      available: 30,
      type: "SEASONAL",
      name: "Watermelon",
      seasonStartDate: new Date(Date.now() - 2 * d),
      seasonEndDate: new Date(Date.now() + 58 * d),
    },
    {
      leadTime: 15,
      available: 30,
      type: "SEASONAL",
      name: "Grapes",
      seasonStartDate: new Date(Date.now() + 180 * d),
      seasonEndDate: new Date(Date.now() + 240 * d),
    },
  ];
};

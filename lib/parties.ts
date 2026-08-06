import type { BlocKey, PartyKey, PartyMeta } from "./types";

export const parties: Record<PartyKey, PartyMeta> = {
  likud: {
    key: "likud",
    name: "הליכוד",
    leader: "נתניהו",
    leaderFull: "בנימין נתניהו",
    color: "#2196F3",
    bloc: "coalition"
  },
  religious_zionism: {
    key: "religious_zionism",
    name: "הציונות הדתית",
    leader: "סמוטריץ'",
    leaderFull: "בצלאל סמוטריץ'",
    color: "#FF5722",
    bloc: "coalition"
  },
  otzma_yehudit: {
    key: "otzma_yehudit",
    name: "עוצמה יהודית",
    leader: "בן גביר",
    leaderFull: "איתמר בן גביר",
    color: "#F57F17",
    bloc: "coalition"
  },
  shas: {
    key: "shas",
    name: "ש\"ס",
    leader: "דרעי",
    leaderFull: "אריה דרעי",
    color: "#004D40",
    bloc: "coalition"
  },
  utj: {
    key: "utj",
    name: "יהדות התורה",
    leaderFull: "יצחק גולדקנופף",
    color: "#1A237E",
    bloc: "coalition"
  },
  together: {
    key: "together",
    name: "יחד",
    leader: "בנט",
    leaderFull: "נפתלי בנט",
    color: "#FF9800",
    bloc: "opposition"
  },
  yisrael_beiteinu: {
    key: "yisrael_beiteinu",
    name: "ישראל ביתנו",
    leader: "ליברמן",
    leaderFull: "אביגדור ליברמן",
    color: "#0D47A1",
    bloc: "opposition"
  },
  democrats: {
    key: "democrats",
    name: "הדמוקרטים",
    leaderFull: "יאיר גולן",
    color: "#E91E63",
    bloc: "opposition"
  },
  yashar: {
    key: "yashar",
    name: "ישר",
    leader: "איזנקוט",
    leaderFull: "גדי איזנקוט",
    color: "#607D8B",
    bloc: "opposition"
  },
  raam: {
    key: "raam",
    name: "רע\"ם",
    leader: "עבאס",
    color: "#4CAF50",
    bloc: "unaligned"
  },
  hadash_taal: {
    key: "hadash_taal",
    name: "חד\"ש-תע\"ל",
    color: "#F44336",
    bloc: "unaligned"
  },
  balad: {
    key: "balad",
    name: "בל\"ד",
    color: "#8E24AA",
    bloc: "unaligned"
  },
  joint_list: {
    key: "joint_list",
    name: "הרשימה המשותפת",
    color: "#2E7D32",
    bloc: "unaligned"
  },
  reservists: {
    key: "reservists",
    name: "המילואימניקים",
    leader: "הנדל",
    leaderFull: "יועז הנדל",
    color: "#795548",
    bloc: "unaligned"
  },
  bennett_2026: {
    key: "bennett_2026",
    name: "בנט 2026",
    leader: "בנט",
    color: "#FFB74D",
    bloc: "opposition"
  },
  yesh_atid: {
    key: "yesh_atid",
    name: "יש עתיד",
    color: "#03A9F4",
    bloc: "opposition"
  },
  blue_and_white: {
    key: "blue_and_white",
    name: "כחול לבן",
    color: "#64B5F6",
    bloc: "opposition"
  }
};

export const blocLabels: Record<BlocKey, string> = {
  coalition: "גוש הקואליציה",
  opposition: "גוש האופוזיציה",
  unaligned: "לא מיושרים"
};

export const currentPartyOrder: PartyKey[] = [
  "likud",
  "together",
  "yisrael_beiteinu",
  "democrats",
  "yashar",
  "shas",
  "utj",
  "otzma_yehudit",
  "religious_zionism",
  "raam",
  "hadash_taal"
];

export const coalitionParties: PartyKey[] = [
  "likud",
  "religious_zionism",
  "otzma_yehudit",
  "shas",
  "utj"
];

export const oppositionParties: PartyKey[] = [
  "together",
  "yisrael_beiteinu",
  "democrats",
  "yashar"
];

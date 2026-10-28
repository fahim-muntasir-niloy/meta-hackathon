/** Bangladesh's 8 divisions and 64 districts, Bangla label + official English name.
 * English names are what the agent's tools (weather, geocoding) search with. */
export type Place = { en: string; bn: string };
export type Division = Place & { districts: Place[] };

export const DIVISIONS: Division[] = [
  {
    en: "Barishal",
    bn: "বরিশাল",
    districts: [
      { en: "Barguna", bn: "বরগুনা" },
      { en: "Barishal", bn: "বরিশাল" },
      { en: "Bhola", bn: "ভোলা" },
      { en: "Jhalokathi", bn: "ঝালকাঠি" },
      { en: "Patuakhali", bn: "পটুয়াখালী" },
      { en: "Pirojpur", bn: "পিরোজপুর" },
    ],
  },
  {
    en: "Chattogram",
    bn: "চট্টগ্রাম",
    districts: [
      { en: "Bandarban", bn: "বান্দরবান" },
      { en: "Brahmanbaria", bn: "ব্রাহ্মণবাড়িয়া" },
      { en: "Chandpur", bn: "চাঁদপুর" },
      { en: "Chattogram", bn: "চট্টগ্রাম" },
      { en: "Cox's Bazar", bn: "কক্সবাজার" },
      { en: "Cumilla", bn: "কুমিল্লা" },
      { en: "Feni", bn: "ফেনী" },
      { en: "Khagrachhari", bn: "খাগড়াছড়ি" },
      { en: "Lakshmipur", bn: "লক্ষ্মীপুর" },
      { en: "Noakhali", bn: "নোয়াখালী" },
      { en: "Rangamati", bn: "রাঙ্গামাটি" },
    ],
  },
  {
    en: "Dhaka",
    bn: "ঢাকা",
    districts: [
      { en: "Dhaka", bn: "ঢাকা" },
      { en: "Faridpur", bn: "ফরিদপুর" },
      { en: "Gazipur", bn: "গাজীপুর" },
      { en: "Gopalganj", bn: "গোপালগঞ্জ" },
      { en: "Kishoreganj", bn: "কিশোরগঞ্জ" },
      { en: "Madaripur", bn: "মাদারীপুর" },
      { en: "Manikganj", bn: "মানিকগঞ্জ" },
      { en: "Munshiganj", bn: "মুন্সীগঞ্জ" },
      { en: "Narayanganj", bn: "নারায়ণগঞ্জ" },
      { en: "Narsingdi", bn: "নরসিংদী" },
      { en: "Rajbari", bn: "রাজবাড়ী" },
      { en: "Shariatpur", bn: "শরীয়তপুর" },
      { en: "Tangail", bn: "টাঙ্গাইল" },
    ],
  },
  {
    en: "Khulna",
    bn: "খুলনা",
    districts: [
      { en: "Bagerhat", bn: "বাগেরহাট" },
      { en: "Chuadanga", bn: "চুয়াডাঙ্গা" },
      { en: "Jashore", bn: "যশোর" },
      { en: "Jhenaidah", bn: "ঝিনাইদহ" },
      { en: "Khulna", bn: "খুলনা" },
      { en: "Kushtia", bn: "কুষ্টিয়া" },
      { en: "Magura", bn: "মাগুরা" },
      { en: "Meherpur", bn: "মেহেরপুর" },
      { en: "Narail", bn: "নড়াইল" },
      { en: "Satkhira", bn: "সাতক্ষীরা" },
    ],
  },
  {
    en: "Mymensingh",
    bn: "ময়মনসিংহ",
    districts: [
      { en: "Jamalpur", bn: "জামালপুর" },
      { en: "Mymensingh", bn: "ময়মনসিংহ" },
      { en: "Netrokona", bn: "নেত্রকোনা" },
      { en: "Sherpur", bn: "শেরপুর" },
    ],
  },
  {
    en: "Rajshahi",
    bn: "রাজশাহী",
    districts: [
      { en: "Bogura", bn: "বগুড়া" },
      { en: "Chapainawabganj", bn: "চাঁপাইনবাবগঞ্জ" },
      { en: "Joypurhat", bn: "জয়পুরহাট" },
      { en: "Naogaon", bn: "নওগাঁ" },
      { en: "Natore", bn: "নাটোর" },
      { en: "Pabna", bn: "পাবনা" },
      { en: "Rajshahi", bn: "রাজশাহী" },
      { en: "Sirajganj", bn: "সিরাজগঞ্জ" },
    ],
  },
  {
    en: "Rangpur",
    bn: "রংপুর",
    districts: [
      { en: "Dinajpur", bn: "দিনাজপুর" },
      { en: "Gaibandha", bn: "গাইবান্ধা" },
      { en: "Kurigram", bn: "কুড়িগ্রাম" },
      { en: "Lalmonirhat", bn: "লালমনিরহাট" },
      { en: "Nilphamari", bn: "নীলফামারী" },
      { en: "Panchagarh", bn: "পঞ্চগড়" },
      { en: "Rangpur", bn: "রংপুর" },
      { en: "Thakurgaon", bn: "ঠাকুরগাঁও" },
    ],
  },
  {
    en: "Sylhet",
    bn: "সিলেট",
    districts: [
      { en: "Habiganj", bn: "হবিগঞ্জ" },
      { en: "Moulvibazar", bn: "মৌলভীবাজার" },
      { en: "Sunamganj", bn: "সুনামগঞ্জ" },
      { en: "Sylhet", bn: "সিলেট" },
    ],
  },
];

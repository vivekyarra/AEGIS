const PRODUCTS = [
  // Electronics (8 items)
  {
    id: "elec-1",
    sku: "EL-SONY-WH1000",
    name: "Sony WH-1000XM5 Headphones",
    category: "Electronics",
    price: 398.00,
    stock: 45,
    description: "Industry-leading noise-canceling wireless headphones with premium sound quality and smart control features."
  },
  {
    id: "elec-2",
    sku: "EL-APPL-IP15P",
    name: "Apple iPhone 15 Pro Max 256GB",
    category: "Electronics",
    price: 1199.00,
    stock: 15,
    description: "The ultimate iPhone featuring a titanium design, A17 Pro chip, custom Action button, and 5x Telephoto camera."
  },
  {
    id: "elec-3",
    sku: "EL-LOGI-MXM3S",
    name: "Logitech MX Master 3S Mouse",
    category: "Electronics",
    price: 99.99,
    stock: 120,
    description: "An iconic ergonomic wireless mouse with silent clicks, 8K DPI tracking on any surface, and MagSpeed scrolling."
  },
  {
    id: "elec-4",
    sku: "EL-SAMS-T7S50",
    name: "Samsung T7 Shield 1TB SSD",
    category: "Electronics",
    price: 129.99,
    stock: 85,
    description: "Superfast external solid-state drive with rugged IP65 water and dust resistance for creators on the go."
  },
  {
    id: "elec-5",
    sku: "EL-BOSE-QCULT",
    name: "Bose QuietComfort Ultra Earbuds",
    category: "Electronics",
    price: 299.00,
    stock: 30,
    description: "Premium spatial audio wireless earbuds with custom-tuned noise cancellation and secure fit."
  },
  {
    id: "elec-6",
    sku: "EL-ASUS-ROG32",
    name: "ASUS ROG Swift 32\" Gaming Monitor",
    category: "Electronics",
    price: 899.99,
    stock: 10,
    description: "Ultra-fast 240Hz OLED gaming monitor with 0.03ms response time, 4K UHD resolution, and custom heatsink."
  },
  {
    id: "elec-7",
    sku: "EL-KEYC-K2V2W",
    name: "Keychron K2 Mechanical Keyboard",
    category: "Electronics",
    price: 89.99,
    stock: 55,
    description: "Compact 75% layout wireless mechanical keyboard with Gateron G Pro switches and RGB backlighting."
  },
  {
    id: "elec-8",
    sku: "EL-DEL-U2723",
    name: "Dell UltraSharp 27\" USB-C Hub Monitor",
    category: "Electronics",
    price: 479.99,
    stock: 22,
    description: "Professional productivity monitor featuring IPS Black technology, 4K resolution, and 90W USB-C power delivery."
  },

  // Clothing (6 items)
  {
    id: "clot-1",
    sku: "CL-PATG-DOWN",
    name: "Patagonia Down Sweater Jacket",
    category: "Clothing",
    price: 279.00,
    stock: 25,
    description: "Featherweight, windproof, and warm down jacket insulated with 800-fill-power 100% Advanced Global Traceable Down."
  },
  {
    id: "clot-2",
    sku: "CL-LEVI-501ST",
    name: "Levi's 501 Original Fit Jeans",
    category: "Clothing",
    price: 79.50,
    stock: 110,
    description: "The original button fly jeans since 1873. Straight fit through the hip and thigh with a classic look."
  },
  {
    id: "clot-3",
    sku: "CL-CHMP-REVP",
    name: "Champion Reverse Weave Hoodie",
    category: "Clothing",
    price: 65.00,
    stock: 75,
    description: "Heavyweight fleece hoodie cut on the cross-grain to resist vertical shrinkage, featuring classic athletic fit."
  },
  {
    id: "clot-4",
    sku: "CL-CARH-WIPJ",
    name: "Carhartt WIP Detroit Jacket",
    category: "Clothing",
    price: 228.00,
    stock: 18,
    description: "Rugged organic cotton canvas work jacket with blanket lining, corduroy collar, and triple-stitched details."
  },
  {
    id: "clot-5",
    sku: "CL-UNIQ-AIRM",
    name: "Uniqlo AIRism Cotton Crew Neck T-Shirt",
    category: "Clothing",
    price: 19.90,
    stock: 250,
    description: "Smart hybrid fabric with the clean look of cotton and the smooth, moisture-wicking comfort of AIRism."
  },
  {
    id: "clot-6",
    sku: "CL-THNF-APEC",
    name: "The North Face Apex Bionic Jacket",
    category: "Clothing",
    price: 149.00,
    stock: 40,
    description: "Windproof soft-shell jacket for hiking or active wear in cool weather, with durable water-repellent finish."
  },

  // Sports (6 items)
  {
    id: "spor-1",
    sku: "SP-NIKE-AM270",
    name: "Nike Air Max 270 Running Shoes",
    category: "Sports",
    price: 160.00,
    stock: 60,
    description: "Lifestyle running shoes featuring Nike's tallest heel bag yet for an incredibly soft, cushioned ride."
  },
  {
    id: "spor-2",
    sku: "SP-SPAL-TF1000",
    name: "Spalding TF-1000 Precision Basketball",
    category: "Sports",
    price: 74.99,
    stock: 90,
    description: "Official size indoor game basketball with advanced moisture management cover for ultimate grip."
  },
  {
    id: "spor-3",
    sku: "SP-YETI-RMB36",
    name: "Yeti Rambler 36 oz Water Bottle",
    category: "Sports",
    price: 50.00,
    stock: 150,
    description: "Double-wall vacuum insulated stainless steel bottle with Chug Cap, designed to keep water ice-cold."
  },
  {
    id: "spor-4",
    sku: "SP-WILS-CL100",
    name: "Wilson Clash 100 V2 Tennis Racket",
    category: "Sports",
    price: 269.00,
    stock: 12,
    description: "Revolutionary flex-performance tennis racket offering the ultimate blend of control, power, and comfort."
  },
  {
    id: "spor-5",
    sku: "SP-FITB-CHRG6",
    name: "Fitbit Charge 6 Fitness Tracker",
    category: "Sports",
    price: 159.95,
    stock: 48,
    description: "Premium fitness band with built-in GPS, active zone minutes, 24/7 heart rate tracking, and Google tools."
  },
  {
    id: "spor-6",
    sku: "SP-TRX-PRO4S",
    name: "TRX PRO4 Suspension Trainer System",
    category: "Sports",
    price: 249.95,
    stock: 35,
    description: "Professional-grade bodyweight exercise resistance bands for full-body workouts anywhere, anytime."
  }
];

module.exports = { PRODUCTS };

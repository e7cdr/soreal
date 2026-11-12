// Frontend/soreal/lib/storytelling-templates.js
//
// Storytelling description templates for real estate listings.
// Based on the "Qué es el storytelling: aprende a contar historias que cautiven" course material.
// Each template converts property features into benefit-driven narratives that resonate
// with a specific buyer persona.

export const STORYTELLING_TEMPLATES = {
  // ---- Persona-based templates ----

  young_family: {
    name: "Young Family",
    description:
      "Discover your family's next chapter in {title}. With {bedrooms} bedrooms and {bathrooms} bathrooms, there's room for everyone to grow. The {property_type} in {city} offers a safe, welcoming neighborhood where children can thrive and parents can build lasting memories. Imagine weekend breakfasts in the kitchen, afternoons in the garden, and evenings gathered around the dining table. This isn't just a property — it's the backdrop for your family's future.",
    useCases: ["first-home", "growing-family", "suburban-living"],
  },

  investor: {
    name: "Investor",
    description:
      "Smart investors know that {title} in {city} represents more than just a {property_type} — it's an opportunity. With {bedrooms} bedrooms and strong rental demand in the area, this property offers solid rental yield and appreciation potential. The {area_sqm} m² of thoughtfully designed space appeals to quality tenants, keeping vacancy low and returns steady. Add this to your portfolio and let the market work for you.",
    useCases: ["rental-income", "portfolio-growth", "appreciation"],
  },

  retiree: {
    name: "Retiree",
    description:
      "After years of hard work, you deserve a place that matches your pace. {title} in {city} offers {bedrooms} bedrooms of peaceful comfort, with {bathrooms} bathrooms designed for easy living. No stairs to climb, no excessive maintenance — just a {property_type} where you can relax, entertain friends, and enjoy your retirement on your own terms. Close to amenities yet quiet enough to unwind, this is the home you've earned.",
    useCases: ["downsizing", "low-maintenance", "peaceful-retirement"],
  },

  first_home: {
    name: "First Home Buyer",
    description:
      "Your first home should be unforgettable — and {title} delivers. This {property_type} in {city} combines practical living with modern comfort across {bedrooms} bedrooms and {bathrooms} bathrooms. Whether you're a young professional starting out or a couple planting roots, this is where your independence begins. Step through the front door and into a life of your own making.",
    useCases: ["first-time-buyer", "young-couple", "independence"],
  },

  luxury: {
    name: "Luxury Seeker",
    description:
      "Elevate your lifestyle with {title} in {city}. This exceptional {property_type} showcases {bedrooms} bedrooms and {bathrooms} bathrooms of refined living, spread across {area_sqm} m² of premium space. Every detail has been considered — from the finishes to the layout — creating a residence that doesn't just impress, but inspires. This is more than a property. It's a statement.",
    useCases: ["high-end", "luxury-living", "status"],
  },

  vacation_home: {
    name: "Vacation Home",
    description:
      "Escape the everyday at {title} in {city}. This {property_type} offers {bedrooms} bedrooms and {bathrooms} bathrooms of pure relaxation, perfectly positioned for weekend getaways and extended stays. Whether you're seeking mountain views, ocean breezes, or a peaceful retreat, this is your sanctuary away from the city. Make every vacation feel like coming home.",
    useCases: ["weekend-getaway", "holiday-home", "relaxation"],
  },
};

// Templates keyed by property type (fallback when no persona is set)
export const PROPERTY_TYPE_TEMPLATES = {
  apartment:
    "Modern living in {city}. This {property_type} features {bedrooms} bedrooms and {bathrooms} bathrooms, designed for contemporary lifestyles. Conveniently located with easy access to shops, restaurants, and transit, {title} offers the perfect balance of comfort and connectivity.",
  house:
    "Space to breathe, room to grow. {title} in {city} is a {property_type} with {bedrooms} bedrooms and {bathrooms} bathrooms, set on a property that invites outdoor living. Ideal for families who value privacy and room for children, pets, and weekend barbecues.",
  villa:
    "Exclusivity meets comfort at {title}. This {property_type} in {city} offers {bedrooms} bedrooms and {bathrooms} bathrooms of elegant living, with premium finishes throughout. Perfect for those who appreciate space, privacy, and a touch of luxury in everyday life.",
  land:
    "A blank canvas in {city}. This {area_sqm} m² plot offers endless possibilities — build your dream home, start a development, or hold as a long-term investment. With {title}, the future is yours to shape.",
  commercial:
    "Position your business for success at {title} in {city}. This commercial {property_type} offers {area_sqm} m² of flexible space with excellent visibility and access. Whether you're opening a shop, office, or service business, this location puts you where your customers are.",
};

// Story angles for marketing copy
export const STORY_ANGLES = {
  lifestyle: "Focus on the daily experience — mornings, evenings, weekends at home.",
  investment: "Focus on returns, rental yield, appreciation, and portfolio value.",
  family: "Focus on children, safety, space to grow, and family memories.",
  retirement: "Focus on peace, low maintenance, accessibility, and enjoyment.",
  first_home: "Focus on independence, achievement, and starting a new chapter.",
  luxury: "Focus on exclusivity, premium finishes, and elevated living.",
};

export function getTemplateForPersona(personaName) {
  if (!personaName) return null;
  const key = personaName.toLowerCase().replace(/\s+/g, "_");
  return STORYTELLING_TEMPLATES[key] || null;
}

export function getTemplateForPropertyType(propertyType) {
  return PROPERTY_TYPE_TEMPLATES[propertyType] || null;
}

export function renderTemplate(template, estate) {
  if (!template) return "";
  return template
    .replace(/\{title\}/g, estate.title || "")
    .replace(/\{property_type\}/g, estate.property_type || "")
    .replace(/\{city\}/g, estate.city || "")
    .replace(/\{province\}/g, estate.province || "")
    .replace(/\{bedrooms\}/g, estate.bedrooms || "")
    .replace(/\{bathrooms\}/g, estate.bathrooms || "")
    .replace(/\{area_sqm\}/g, estate.area_sqm || "")
    .replace(/\{price\}/g, estate.price || "")
    .replace(/\{currency\}/g, estate.currency || "");
}

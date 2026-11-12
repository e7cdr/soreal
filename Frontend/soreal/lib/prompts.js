// Frontend/soreal/lib/prompts.json
//
// AI prompt library for real estate marketing content generation.
// Based on "7 Prompts Estratégicos para Crear Contenido que Vende en Redes Sociales" course material.
// All prompts are bilingual (EN/ES) so agents can generate content in either language.
//
// Usage: Import this file and select a prompt by category. Fill in the {{placeholders}}
// with property details, then send to your preferred AI assistant.

export const PROMPT_CATEGORIES = {
  listing_description: "Listing Description",
  ad_copy: "Ad Copy",
  social_caption: "Social Caption",
  email_subject: "Email Subject",
  whatsapp_message: "WhatsApp Message",
  story_script: "Story Script",
  carousel_script: "Carousel Script",
};

export const PROMPTS = {
  // ------------------------------------------------------------
  // Listing Descriptions
  // ------------------------------------------------------------
  listing_description_luxury: {
    category: "listing_description",
    name_en: "Luxury Property Description",
    name_es: "Descripción de Propiedad de Lujo",
    prompt_en: `Write a compelling luxury real estate listing description for:
- Title: {{title}}
- Location: {{city}}, {{province}}
- Type: {{property_type}}
- Bedrooms: {{bedrooms}}, Bathrooms: {{bathrooms}}
- Area: {{area_sqm}} m²
- Price: {{currency}} {{price}}

Focus on exclusivity, premium finishes, and lifestyle benefits. Use evocative language that appeals to high-net-worth buyers. Include a strong call-to-action to schedule a viewing. Write in English.`,

    prompt_es: `Escribe una descripción de listado inmobiliario de lujo para:
- Título: {{title}}
- Ubicación: {{ciudad}}, {{provincia}}
- Tipo: {{property_type}}
- Habitaciones: {{bedrooms}}, Baños: {{bathrooms}}
- Área: {{area_sqm}} m²
- Precio: {{currency}} {{price}}

Enfócate en exclusividad, acabados premium y beneficios de estilo de vida. Usa lenguaje evocador que atraiga a compradores de alto poder adquisitivo. Incluye una llamada a la acción fuerte para programar una visita. Escribe en español.`,

    variables: ["title", "city", "province", "property_type", "bedrooms", "bathrooms", "area_sqm", "currency", "price"],
  },

  listing_description_family: {
    category: "listing_description",
    name_en: "Family Home Description",
    name_es: "Descripción de Hogar Familiar",
    prompt_en: `Write a warm, family-oriented real estate listing description for:
- Title: {{title}}
- Location: {{city}}, {{province}}
- Type: {{property_type}}
- Bedrooms: {{bedrooms}}, Bathrooms: {{bathrooms}}
- Area: {{area_sqm}} m²
- Price: {{currency}} {{price}}

Focus on space for children to grow, safe neighborhood, family gatherings, and making memories. Emphasize the lifestyle benefits for families with kids. Write in English.`,

    prompt_es: `Escribe una descripción cálida y orientada a familia para un listado inmobiliario:
- Título: {{title}}
- Ubicación: {{ciudad}}, {{provincia}}
- Tipo: {{property_type}}
- Habitaciones: {{bedrooms}}, Baños: {{bathrooms}}
- Área: {{area_sqm}} m²
- Precio: {{currency}} {{price}}

Enfócate en espacio para que los niños crezcan, vecindario seguro, reuniones familiares y crear recuerdos. Énfasis en los beneficios de estilo de vida para familias con niños. Escribe en español.`,

    variables: ["title", "city", "province", "property_type", "bedrooms", "bathrooms", "area_sqm", "currency", "price"],
  },

  listing_description_investor: {
    category: "listing_description",
    name_en: "Investment Property Description",
    name_es: "Descripción de Propiedad de Inversión",
    prompt_en: `Write an investment-focused real estate listing description for:
- Title: {{title}}
- Location: {{city}}, {{province}}
- Type: {{property_type}}
- Bedrooms: {{bedrooms}}, Bathrooms: {{bathrooms}}
- Area: {{area_sqm}} m²
- Price: {{currency}} {{price}}

Focus on rental yield potential, appreciation, tenant demand, and portfolio diversification. Include numbers where possible and a clear ROI narrative. Write in English.`,

    prompt_es: `Escribe una descripción enfocada en inversión para un listado inmobiliario:
- Título: {{title}}
- Ubicación: {{ciudad}}, {{provincia}}
- Tipo: {{property_type}}
- Habitaciones: {{bedrooms}}, Baños: {{bathrooms}}
- Área: {{area_sqm}} m²
- Precio: {{currency}} {{price}}

Enfócate en potencial de rendimiento de alquiler, apreciación, demanda de inquilinos y diversificación de portafolio. Incluye números cuando sea posible y una narrativa clara de ROI. Escribe en español.`,

    variables: ["title", "city", "province", "property_type", "bedrooms", "bathrooms", "area_sqm", "currency", "price"],
  },

  // ------------------------------------------------------------
  // Ad Copy
  // ------------------------------------------------------------
  ad_copy_facebook: {
    category: "ad_copy",
    name_en: "Facebook Ad Copy",
    name_es: "Anuncio de Facebook",
    prompt_en: `Write a Facebook ad copy for a real estate listing:
- Property: {{title}} in {{city}}, {{province}}
- Type: {{property_type}}
- Price: {{currency}} {{price}}
- Objective: {{objective}} (traffic/messages/leads)
- Target: {{target_audience}}

Include: hook, key features, benefit-driven body, and clear CTA. Max 125 characters for primary text. Write in English.`,

    prompt_es: `Escribe un anuncio de Facebook para un listado inmobiliario:
- Propiedad: {{title}} en {{ciudad}}, {{provincia}}
- Tipo: {{property_type}}
- Precio: {{currency}} {{price}}
- Objetivo: {{objective}} (tráfico/mensajes/contactos)
- Público objetivo: {{target_audience}}

Incluye: gancho, características clave, cuerpo orientado a beneficios y CTA claro. Máximo 125 caracteres para el texto principal. Escribe en español.`,

    variables: ["title", "city", "province", "property_type", "currency", "price", "objective", "target_audience"],
  },

  ad_copy_instagram: {
    category: "ad_copy",
    name_en: "Instagram Ad Copy",
    name_es: "Anuncio de Instagram",
    prompt_en: `Write an Instagram ad caption for a property listing:
- Property: {{title}} in {{city}}
- Type: {{property_type}}
- Price: {{currency}} {{price}}
- Bedrooms: {{bedrooms}}

Include: attention-grabbing first line, 3-4 emojis, key features as bullet points, relevant hashtags (#realestate #{{city}} #forsale), and CTA to DM or visit link. Write in English.`,

    prompt_es: `Escribe un título de anuncio de Instagram para un listado inmobiliario:
- Propiedad: {{title}} en {{ciudad}}
- Tipo: {{property_type}}
- Precio: {{currency}} {{price}}
- Habitaciones: {{bedrooms}}

Incluye: primera línea llamativa, 3-4 emojis, características clave como viñetas, hashtags relevantes (#bienesraices #{{ciudad}} #enventa), y CTA para DM o visitar enlace. Escribe en español.`,

    variables: ["title", "city", "property_type", "currency", "price", "bedrooms"],
  },

  // ------------------------------------------------------------
  // Social Captions
  // ------------------------------------------------------------
  social_caption_new_listing: {
    category: "social_caption",
    name_en: "New Listing Announcement",
    name_es: "Anuncio de Nuevo Listado",
    prompt_en: `Write a social media caption announcing a new property listing:
- Property: {{title}}
- Location: {{city}}, {{province}}
- Type: {{property_type}}
- Price: {{currency}} {{price}}
- Bedrooms: {{bedrooms}}, Bathrooms: {{bathrooms}}

Tone: exciting, welcoming, professional. Include hashtags and a CTA to message for details. Write in English.`,

    prompt_es: `Escribe un título de redes sociales anunciando un nuevo listado inmobiliario:
- Propiedad: {{title}}
- Ubicación: {{ciudad}}, {{provincia}}
- Tipo: {{property_type}}
- Precio: {{currency}} {{price}}
- Habitaciones: {{bedrooms}}, Baños: {{bathrooms}}

Tono: emocionante, acogedor, profesional. Incluye hashtags y CTA para escribir por detalles. Escribe en español.`,

    variables: ["title", "city", "province", "property_type", "currency", "price", "bedrooms", "bathrooms"],
  },

  social_caption_price_drop: {
    category: "social_caption",
    name_en: "Price Reduction Announcement",
    name_es: "Anuncio de Reducción de Precio",
    prompt_en: `Write a social media caption announcing a price reduction:
- Property: {{title}} in {{city}}
- Old price: {{old_price}} {{currency}}
- New price: {{new_price}} {{currency}}
- Savings: {{savings}} {{currency}}

Tone: urgent but professional, highlighting the opportunity. Include CTA to act fast. Write in English.`,

    prompt_es: `Escribe un título de redes sociales anunciando una reducción de precio:
- Propiedad: {{title}} en {{ciudad}}
- Precio anterior: {{old_price}} {{currency}}
- Nuevo precio: {{new_price}} {{currency}}
- Ahorro: {{savings}} {{currency}}

Tono: urgente pero profesional, destacando la oportunidad. Incluye CTA para actuar rápido. Escribe en español.`,

    variables: ["title", "city", "old_price", "new_price", "currency", "savings"],
  },

  // ------------------------------------------------------------
  // Email Subject Lines
  // ------------------------------------------------------------
  email_subject_new_listing: {
    category: "email_subject",
    name_en: "New Listing Email Subject",
    name_es: "Asunto de Email de Nuevo Listado",
    prompt_en: `Write 5 email subject lines for a new property listing announcement:
- Property: {{title}} in {{city}}
- Type: {{property_type}}
- Price: {{currency}} {{price}}

Make them curiosity-driven, urgent, and benefit-focused. Write in English.`,

    prompt_es: `Escribe 5 asuntos de email para anunciar un nuevo listado inmobiliario:
- Propiedad: {{title}} en {{ciudad}}
- Tipo: {{property_type}}
- Precio: {{currency}} {{price}}

Hazlos curiosos, urgentes y enfocados en beneficios. Escribe en español.`,

    variables: ["title", "city", "property_type", "currency", "price"],
  },

  email_subject_viewing_request: {
    category: "email_subject",
    name_en: "Viewing Request Email Subject",
    name_es: "Asunto de Email de Solicitud de Visita",
    prompt_en: `Write 5 email subject lines for a property viewing request:
- Property: {{title}} in {{city}}
- Buyer: {{buyer_name}}

Tone: professional, personal, action-oriented. Write in English.`,

    prompt_es: `Escribe 5 asuntos de email para una solicitud de visita de propiedad:
- Propiedad: {{title}} en {{ciudad}}
- Comprador: {{buyer_name}}

Tono: profesional, personal, orientado a la acción. Escribe en español.`,

    variables: ["title", "city", "buyer_name"],
  },

  // ------------------------------------------------------------
  // WhatsApp Messages
  // ------------------------------------------------------------
  whatsapp_new_listing: {
    category: "whatsapp_message",
    name_en: "WhatsApp New Listing Message",
    name_es: "Mensaje de WhatsApp de Nuevo Listado",
    prompt_en: `Write a WhatsApp message to share a new property listing with a contact:
- Property: {{title}} in {{city}}
- Type: {{property_type}}
- Price: {{currency}} {{price}}
- Bedrooms: {{bedrooms}}

Tone: friendly, conversational, concise. Include CTA to reply for more info or schedule a viewing. Write in English.`,

    prompt_es: `Escribe un mensaje de WhatsApp para compartir un nuevo listado inmobiliario con un contacto:
- Propiedad: {{title}} en {{ciudad}}
- Tipo: {{property_type}}
- Precio: {{currency}} {{price}}
- Habitaciones: {{bedrooms}}

Tono: amigable, conversacional, conciso. Incluye CTA para responder por más información o programar una visita. Escribe en español.`,

    variables: ["title", "city", "property_type", "currency", "price", "bedrooms"],
  },

  whatsapp_follow_up: {
    category: "whatsapp_message",
    name_en: "WhatsApp Follow-up Message",
    name_es: "Mensaje de WhatsApp de Seguimiento",
    prompt_en: `Write a WhatsApp follow-up message to a lead who viewed a property:
- Property: {{title}}
- Lead name: {{lead_name}}
- Last contact: {{last_contact}}

Tone: helpful, non-pushy, offering additional info or a second viewing. Write in English.`,

    prompt_es: `Escribe un mensaje de WhatsApp de seguimiento a un lead que visitó una propiedad:
- Propiedad: {{title}}
- Nombre del lead: {{lead_name}}
- Último contacto: {{last_contact}}

Tono: servicial, no insistente, ofreciendo información adicional o una segunda visita. Escribe en español.`,

    variables: ["title", "lead_name", "last_contact"],
  },

  // ------------------------------------------------------------
  // Story Scripts
  // ------------------------------------------------------------
  story_script_property_tour: {
    category: "story_script",
    name_en: "Instagram/Facebook Story Script",
    name_es: "Guion de Historia de Instagram/Facebook",
    prompt_en: `Write a short story script (3-4 slides) for a property tour:
- Property: {{title}} in {{city}}
- Type: {{property_type}}
- Key features: {{key_features}}

Structure: Hook slide -> Interior highlight -> Key feature -> Price/location -> CTA (DM to visit). Include on-screen text suggestions. Write in English.`,

    prompt_es: `Escribe un guion corto (3-4 diapositivas) para un tour de propiedad en historias:
- Propiedad: {{title}} en {{ciudad}}
- Tipo: {{property_type}}
- Características clave: {{key_features}}

Estructura: Diapositiva de gancho -> Destacado interior -> Característica clave -> Precio/ubicación -> CTA (DM para visitar). Incluye sugerencias de texto en pantalla. Escribe en español.`,

    variables: ["title", "city", "property_type", "key_features"],
  },

  // ------------------------------------------------------------
  // Carousel Scripts
  // ------------------------------------------------------------
  carousel_script_5_reasons: {
    category: "carousel_script",
    name_en: "5 Reasons to Buy Carousel",
    name_es: "5 Razones para Comprar Carrusel",
    prompt_en: `Write a 5-slide Instagram carousel script:
- Property: {{title}} in {{city}}
- Slide 1: Hook (why this property is special)
- Slide 2-4: Three key features/benefits
- Slide 5: CTA (price, location, DM to schedule)

Write in English.`,

    prompt_es: `Escribe un guion de carrusel de 5 diapositivas para Instagram:
- Propiedad: {{title}} en {{ciudad}}
- Diapositiva 1: Gancho (por qué esta propiedad es especial)
- Diapositivas 2-4: Tres características/beneficios clave
- Diapositiva 5: CTA (precio, ubicación, DM para programar)

Escribe en español.`,

    variables: ["title", "city"],
  },
};

export function getPromptByCategory(category) {
  return Object.values(PROMPTS).filter(p => p.category === category);
}

export function getPromptById(id) {
  return PROMPTS[id] || null;
}

export function getCategories() {
  return Object.entries(PROMPT_CATEGORIES).map(([key, name]) => ({ key, name }));
}

export function renderPrompt(prompt, variables = {}, language = "en") {
  const template = language === "es" ? prompt.prompt_es : prompt.prompt_en;
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
}

// Built-in follow-up message templates. Each body() takes (name, business).
export const MESSAGE_TEMPLATES = {
  introduction: {
    label: "First follow-up",
    subject: "Following up on our conversation",
    body: (name, business) =>
      `Hi ${name},\n\nI hope you're doing well. I wanted to follow up on our recent conversation${business ? ` about ${business}` : ""}. Please let me know if you have any questions or if there is anything I can help you with.\n\nLooking forward to hearing from you!`,
  },
  interested: {
    label: "Interested customer",
    subject: "Checking in",
    body: (name, business) =>
      `Hi ${name},\n\nThank you for your interest${business ? ` in ${business}` : ""}. I wanted to check in and see if you'd like any additional information. I'm happy to answer your questions and help you decide on the next steps.\n\nHope to hear from you soon!`,
  },
  quote: {
    label: "Quote or proposal",
    subject: "Following up on your quote",
    body: (name, business) =>
      `Hi ${name},\n\nI'm following up on the quote or proposal I shared${business ? ` regarding ${business}` : ""}. Have you had a chance to review it? Please let me know if you'd like any changes or have questions.\n\nThank you for your time!`,
  },
  reminder: {
    label: "Polite reminder",
    subject: "A quick follow-up",
    body: (name, business) =>
      `Hi ${name},\n\nI hope all is well. This is a friendly follow-up${business ? ` about ${business}` : ""}. When you have a moment, please let me know if there are any updates or if I can provide anything else.\n\nThanks, and have a great day!`,
  },
  closing: {
    label: "Closing the conversation",
    subject: "Checking in one last time",
    body: (name, business) =>
      `Hi ${name},\n\nI'm checking in one last time${business ? ` about ${business}` : ""}. I understand the timing may not be right, so there's no pressure. If you'd like to reconnect in the future, I'll be happy to help.\n\nWishing you all the best!`,
  },
};

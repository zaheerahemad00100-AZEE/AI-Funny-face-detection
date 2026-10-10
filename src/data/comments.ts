export interface CommentItem {
  id: string;
  text: string;
  category: 'SWAG ALERT' | 'SURPRISE!' | 'SMILE LEGEND' | 'HERO MODE' | 'ROYALTY';
  type: 'general' | 'shock' | 'smile';
  language: 'English';
}

export const INITIAL_COMMENTS: CommentItem[] = [
  // 30 Core English Comments with Emojis
  { id: '1', text: '😂 Average Human', category: 'SWAG ALERT', type: 'general', language: 'English' },
  { id: '2', text: '😎 Looking Good', category: 'SWAG ALERT', type: 'general', language: 'English' },
  { id: '3', text: '✨ Beautiful', category: 'ROYALTY', type: 'general', language: 'English' },
  { id: '4', text: '🔥 So Beautiful', category: 'ROYALTY', type: 'general', language: 'English' },
  { id: '5', text: '👑 Gorgeous', category: 'ROYALTY', type: 'general', language: 'English' },
  { id: '6', text: '🗿 Handsome', category: 'HERO MODE', type: 'general', language: 'English' },
  { id: '7', text: '💎 Very Handsome', category: 'HERO MODE', type: 'general', language: 'English' },
  { id: '8', text: '🚀 LEGENDARY LOOKS', category: 'HERO MODE', type: 'general', language: 'English' },
  { id: '9', text: '👽 Out of This World', category: 'SWAG ALERT', type: 'general', language: 'English' },
  { id: '10', text: '😏 Too Much Swag', category: 'SWAG ALERT', type: 'general', language: 'English' },
  { id: '11', text: '🌟 Superstar Detected', category: 'HERO MODE', type: 'general', language: 'English' },
  { id: '12', text: '🦁 King Energy', category: 'ROYALTY', type: 'general', language: 'English' },
  { id: '13', text: '💯 Absolute Legend', category: 'HERO MODE', type: 'general', language: 'English' },
  { id: '14', text: '🔥 Certified Heartthrob', category: 'SWAG ALERT', type: 'general', language: 'English' },
  { id: '15', text: '😎 Main Character Energy', category: 'HERO MODE', type: 'general', language: 'English' },
  { id: '16', text: '👑 Royal Vibes', category: 'ROYALTY', type: 'general', language: 'English' },
  { id: '17', text: '✨ Pure Charisma', category: 'SWAG ALERT', type: 'general', language: 'English' },
  { id: '18', text: '🚨 Handsomeness Alert', category: 'SWAG ALERT', type: 'general', language: 'English' },
  { id: '19', text: '💎 Premium Looks', category: 'ROYALTY', type: 'general', language: 'English' },
  { id: '20', text: '🕶️ Style Icon', category: 'SWAG ALERT', type: 'general', language: 'English' },
  { id: '21', text: '⚡ Aura Level: 100', category: 'HERO MODE', type: 'general', language: 'English' },
  { id: '22', text: '🌍 Center of Attention', category: 'HERO MODE', type: 'general', language: 'English' },
  { id: '23', text: '🏆 Born to Stand Out', category: 'HERO MODE', type: 'general', language: 'English' },
  { id: '24', text: '😍 Camera\'s Favorite', category: 'ROYALTY', type: 'general', language: 'English' },
  { id: '25', text: '🚀 Next-Level Looks', category: 'SWAG ALERT', type: 'general', language: 'English' },
  { id: '26', text: '🐐 The GOAT Has Arrived', category: 'HERO MODE', type: 'general', language: 'English' },
  { id: '27', text: '🔥 Unstoppable Charm', category: 'SWAG ALERT', type: 'general', language: 'English' },
  { id: '28', text: '💫 Walking Masterpiece', category: 'ROYALTY', type: 'general', language: 'English' },
  { id: '29', text: '👔 Gentleman Mode: ON', category: 'ROYALTY', type: 'general', language: 'English' },
  { id: '30', text: '👾 Legendary Human Unlocked', category: 'HERO MODE', type: 'general', language: 'English' },

  // Facial Reaction: Shock / Mouth Open (English only)
  { id: '31', text: '😲 Mind Blown: Shocked Expression!', category: 'SURPRISE!', type: 'shock', language: 'English' },
  { id: '32', text: '😲 Astonishing Looks Detected!', category: 'SURPRISE!', type: 'shock', language: 'English' },
  { id: '33', text: '😲 Jaw Drop Moment: 100% Shock!', category: 'SURPRISE!', type: 'shock', language: 'English' },
  { id: '34', text: '😲 Out of This World Reaction!', category: 'SURPRISE!', type: 'shock', language: 'English' },

  // Facial Reaction: Smile (English only)
  { id: '35', text: '😄 That\'s a Beautiful Smile!', category: 'SMILE LEGEND', type: 'smile', language: 'English' },
  { id: '36', text: '😄 Million Dollar Smile Confirmed!', category: 'SMILE LEGEND', type: 'smile', language: 'English' },
  { id: '37', text: '😄 1000 Watt Smile Detected!', category: 'SMILE LEGEND', type: 'smile', language: 'English' },
  { id: '38', text: '😄 Pure Joy and Brightness!', category: 'SMILE LEGEND', type: 'smile', language: 'English' },
];

// Concrete, drawable words for Skribbl.
export const SKRIBBL_WORDS: string[] = [
  "apple", "banana", "carrot", "house", "tree", "car", "cat", "dog", "fish",
  "bird", "sun", "moon", "star", "cloud", "rain", "snowman", "flower", "boat",
  "train", "plane", "rocket", "bicycle", "guitar", "piano", "drum", "book",
  "pencil", "scissors", "clock", "phone", "camera", "computer", "chair",
  "table", "bed", "door", "window", "key", "lamp", "candle", "cup", "bottle",
  "fork", "spoon", "knife", "plate", "pizza", "burger", "cake", "ice cream",
  "donut", "cookie", "egg", "cheese", "bread", "hat", "shirt", "shoe", "sock",
  "glasses", "crown", "ring", "umbrella", "balloon", "kite", "ball", "dice",
  "ladder", "hammer", "saw", "nail", "brush", "bucket", "broom", "anchor",
  "bridge", "castle", "tower", "tent", "igloo", "lighthouse", "windmill",
  "mountain", "volcano", "island", "beach", "river", "waterfall", "rainbow",
  "snail", "spider", "butterfly", "bee", "ant", "ladybug", "frog", "turtle",
  "snake", "lizard", "crocodile", "dinosaur", "dragon", "shark", "whale",
  "dolphin", "octopus", "crab", "lobster", "starfish", "jellyfish", "penguin",
  "owl", "eagle", "parrot", "duck", "chicken", "cow", "pig", "sheep", "horse",
  "elephant", "giraffe", "lion", "tiger", "monkey", "bear", "panda", "koala",
  "kangaroo", "rabbit", "mouse", "squirrel", "hedgehog", "fox", "wolf", "deer",
  "robot", "ghost", "alien", "wizard", "pirate", "ninja", "clown", "king",
  "queen", "knight", "angel", "mermaid", "unicorn", "skeleton", "vampire",
  "witch", "santa", "snowflake", "heart", "diamond", "arrow", "flag", "gift",
  "lollipop", "cactus", "mushroom", "leaf", "acorn", "pumpkin", "carousel",
  "ferris wheel", "roller coaster", "swing", "slide", "seesaw", "trampoline",
  "telescope", "microscope", "magnet", "battery", "lightbulb", "gear", "spring",
  "compass", "map", "treasure", "crown", "trophy", "medal", "guitar", "violin",
  "trumpet", "harp", "microphone", "headphones", "television", "radio",
  "toaster", "kettle", "fridge", "oven", "washing machine", "vacuum", "iron",
  "scooter", "skateboard", "surfboard", "helicopter", "submarine", "tractor",
  "ambulance", "fire truck", "police car", "bus", "taxi", "van", "truck",
];

export function pickWord(): string {
  return SKRIBBL_WORDS[Math.floor(Math.random() * SKRIBBL_WORDS.length)];
}

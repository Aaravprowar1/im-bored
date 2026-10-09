import {
  XP_BY_DIFFICULTY,
  type Category,
  type CostType,
  type Difficulty,
  type EnergyLevel,
  type Location,
  type PeopleType,
} from "./types";

/**
 * Hand-curated seed activities. Each slug is the stable key used by the seed
 * process (upsert on slug), so editing text and re-seeding never duplicates rows.
 * Do not change an existing slug; add a new entry instead.
 */
export interface SeedActivity {
  slug: string;
  title: string;
  description: string;
  category: Category;
  duration_minutes: number;
  difficulty: Difficulty;
  location: Location;
  energy_level: EnergyLevel;
  cost_type: CostType;
  people_type: PeopleType;
  xp_reward: number;
  is_chaos: boolean;
  is_featured: boolean;
  safety_note: string | null;
}

type Row = [
  slug: string,
  title: string,
  description: string,
  category: Category,
  minutes: number,
  difficulty: Difficulty,
  location: Location,
  energy: EnergyLevel,
  cost: CostType,
  people: PeopleType,
  flags?: { chaos?: boolean; featured?: boolean; safety?: string },
];

const OUTDOOR_NOTE =
  "Respect private property and stay aware of your surroundings.";
const MOVE_NOTE = "Clear some space first and go at a pace that feels comfortable for your body.";

const rows: Row[] = [
  // ── Creative ────────────────────────────────────────────────────────────
  ["five-object-story", "Five-object story", "Grab five random objects from the room you're in and write or tell a short story where every one of them matters to the plot.", "creative", 15, "easy", "indoors", "low", "free", "either", { featured: true }],
  ["three-colour-self-portrait", "Three-colour self-portrait", "Draw a self-portrait using only three colours. Any medium works: pens, pencils, paint, or a drawing app.", "creative", 30, "medium", "anywhere", "low", "free", "alone"],
  ["bicycle-from-memory", "Draw a bicycle from memory", "Without looking anything up, draw a working bicycle: chain, pedals, brakes and all. Then compare it with a real one.", "creative", 10, "easy", "anywhere", "low", "free", "either"],
  ["six-word-story", "Six-word story", "Write a complete story in exactly six words. Write three versions and keep your favourite.", "creative", 5, "easy", "anywhere", "low", "free", "alone"],
  ["imaginary-flag", "Flag for an imaginary country", "Invent a country, then design its flag. Give every colour and shape a meaning and write one line about its national holiday.", "creative", 20, "easy", "anywhere", "low", "free", "either", { featured: true }],
  ["unusual-angle-photo", "Shoot the ordinary, strangely", "Photograph an everyday object from an angle nobody normally sees it from: underneath, very close, or reflected.", "creative", 10, "easy", "anywhere", "low", "free", "alone"],
  ["blind-contour-drawing", "Blind contour drawing", "Draw your hand without looking at the paper once. Keep the pen moving for two full minutes. Do three attempts.", "creative", 10, "easy", "anywhere", "low", "free", "alone", { featured: true }],
  ["found-poem", "Found poem", "Pick any page of printed text (a receipt, a label, a book) and build a poem only from words that appear on it.", "creative", 15, "easy", "anywhere", "low", "free", "alone"],
  ["one-line-drawing", "One continuous line", "Draw a whole scene, like your desk or a window view, without lifting your pen from the page.", "creative", 15, "medium", "anywhere", "low", "free", "alone"],
  ["mini-zine", "Make a one-sheet zine", "Fold a single sheet of paper into an eight-page mini zine and fill it about one tiny obsession of yours.", "creative", 45, "medium", "indoors", "low", "free", "alone"],
  ["shadow-puppet-scene", "Shadow puppet scene", "Use a lamp and your hands (or cut-out card) to perform a 60-second shadow puppet story.", "creative", 20, "medium", "indoors", "medium", "free", "either"],
  ["alphabet-photo-hunt", "Alphabet photo hunt", "Find and photograph shapes that look like letters in things around you. How far through the alphabet can you get?", "creative", 30, "medium", "anywhere", "medium", "free", "either"],
  ["tiny-sculpture", "Tiny sculpture", "Make a sculpture that fits on a coin using only things from your desk drawer or kitchen.", "creative", 20, "medium", "indoors", "low", "free", "alone"],
  ["redesign-a-logo", "Redesign a logo", "Pick a brand you see every day and sketch a completely different logo for it. Explain your choice in one sentence.", "creative", 20, "medium", "anywhere", "low", "free", "alone"],
  ["album-cover-from-room", "Album cover from your room", "Stage and photograph an album cover using only what is in your room. Invent the band name and track list.", "creative", 30, "medium", "indoors", "medium", "free", "either"],
  ["paint-with-coffee", "Paint with coffee or tea", "Brew a strong cup and use it as watercolour. Paint something in sepia, layering for darker tones.", "creative", 30, "medium", "indoors", "low", "free", "alone"],
  ["collage-of-junk-mail", "Junk mail collage", "Cut up flyers, packaging or old magazines and make a collage portrait of someone you know.", "creative", 40, "medium", "indoors", "low", "free", "alone"],
  ["haiku-of-now", "Haiku of right now", "Write three haiku (5-7-5 syllables) describing exactly what you can see, hear and smell this minute.", "creative", 10, "easy", "anywhere", "low", "free", "alone"],

  // ── Brain ───────────────────────────────────────────────────────────────
  ["fifteen-countries", "15 countries in 30 seconds", "Set a 30-second timer and name 15 countries out loud. Too easy? Try 15 capitals.", "brain", 2, "easy", "anywhere", "low", "free", "either", { featured: true }],
  ["ten-question-quiz", "Write a ten-question quiz", "Create a ten-question quiz about something you love, then test a friend (or future you).", "brain", 20, "medium", "anywhere", "low", "free", "either"],
  ["memory-palace", "Build a memory palace", "Memorise a list of ten random words by placing each one somewhere along a route through your home. Test yourself in an hour.", "brain", 15, "medium", "anywhere", "low", "free", "alone", { featured: true }],
  ["mental-math-sprint", "Mental maths sprint", "Start at 1,000 and subtract 7 repeatedly in your head. How low can you go in two minutes without an error?", "brain", 3, "medium", "anywhere", "low", "free", "alone"],
  ["reverse-alphabet", "Alphabet backwards", "Recite the alphabet backwards. Time yourself, then try to halve that time.", "brain", 3, "easy", "anywhere", "low", "free", "alone"],
  ["twenty-uses-paperclip", "Twenty uses for a paperclip", "List 20 different uses for a paperclip. The last five are where the good ideas live.", "brain", 10, "easy", "anywhere", "low", "free", "either"],
  ["fermi-estimate", "Fermi estimate", "Estimate how many piano tuners work in your city using only reasoning. Write down every assumption, then look up the real answer.", "brain", 15, "hard", "anywhere", "low", "free", "alone", { featured: true }],
  ["logic-grid-puzzle", "Make a logic puzzle", "Write a small logic puzzle with three people, three pets and three clues that has exactly one solution.", "brain", 30, "hard", "anywhere", "low", "free", "alone"],
  ["word-ladder", "Word ladder", "Turn COLD into WARM by changing one letter at a time, making a real word at each step. Then invent your own ladder.", "brain", 10, "medium", "anywhere", "low", "free", "either"],
  ["draw-world-map", "World map from memory", "Draw a map of the world from memory and label as many countries as you can. Then compare it with a real map.", "brain", 20, "medium", "anywhere", "low", "free", "either"],
  ["cipher-message", "Secret cipher", "Invent a substitution cipher, encode a message, and challenge someone to crack it.", "brain", 20, "medium", "anywhere", "low", "free", "with_friends"],
  ["spot-the-pattern", "Number sequence challenge", "Write five number sequences with hidden rules (like 2, 6, 12, 20...) and see if a friend can find the next number.", "brain", 15, "medium", "anywhere", "low", "free", "with_friends"],

  // ── Physical ────────────────────────────────────────────────────────────
  ["tallest-tower", "Tallest stable tower", "Build the tallest freestanding tower you can using safe household objects like books, cups and boxes. It has to stand for ten seconds.", "physical", 20, "medium", "indoors", "medium", "free", "either", { safety: "Use unbreakable objects and keep the tower away from people and pets." }],
  ["paper-ball-course", "Paper ball obstacle course", "Create a mini obstacle course for a scrunched-up paper ball using books and cups, then try to get it through in as few flicks as possible.", "physical", 20, "easy", "indoors", "medium", "free", "either"],
  ["paper-airplane-test", "Paper airplane test lab", "Fold three different paper airplane designs and test which flies furthest. Run each design three times.", "physical", 20, "easy", "indoors", "medium", "free", "either", { featured: true }],
  ["one-minute-plank", "Plank check-in", "Hold a plank for as long as feels good, up to one minute. Rest, then try once more.", "physical", 5, "medium", "anywhere", "high", "free", "alone", { safety: MOVE_NOTE }],
  ["desk-stretch-routine", "Five-minute stretch", "Stretch your neck, shoulders, wrists, back and legs for one minute each. Move slowly and breathe.", "physical", 5, "easy", "anywhere", "low", "free", "alone", { safety: "Stretch gently and stop if anything hurts." }],
  ["learn-to-juggle", "Learn a two-ball juggle", "Use rolled-up socks to practise a two-ball exchange, then try adding a third.", "physical", 20, "medium", "indoors", "medium", "free", "alone", { safety: "Use soft objects and clear the area around you." }],
  ["balance-challenge", "Balance challenge", "Stand on one foot with your eyes closed. Time it on each side, then try again while slowly counting backwards from 20.", "physical", 5, "easy", "indoors", "low", "free", "either", { safety: "Stand near a wall or chair you can hold if you wobble." }],
  ["dance-one-song", "Dance through one song", "Put on a song you love and dance for its whole length. No audience required.", "physical", 5, "easy", "indoors", "high", "free", "either", { safety: MOVE_NOTE }],
  ["sock-basketball", "Sock basketball", "Use a laundry basket as a hoop and rolled socks as balls. Take ten shots from three distances and keep score.", "physical", 10, "easy", "indoors", "medium", "free", "either"],
  ["learn-cup-stack", "Speed cup stacking", "Stack six paper or plastic cups into a pyramid and unstack them. Time yourself and try to beat it five times.", "physical", 10, "easy", "indoors", "medium", "free", "either"],
  ["ten-minute-walk-count", "Ten-minute step game", "Walk for ten minutes and count how many different sounds you hear along the way.", "physical", 10, "easy", "outdoors", "medium", "free", "either", { safety: OUTDOOR_NOTE }],

  // ── Outdoors ────────────────────────────────────────────────────────────
  ["three-blues", "Three almost-identical blues", "Find three things outdoors that are almost exactly the same shade of blue. Photograph them side by side.", "outdoors", 20, "medium", "outdoors", "medium", "free", "either", { safety: OUTDOOR_NOTE }],
  ["cloud-shapes", "Cloud spotting", "Lie or sit somewhere comfortable and find five clouds that look like something. Sketch your favourite.", "outdoors", 15, "easy", "outdoors", "low", "free", "either", { safety: "Never look directly at the sun." }],
  ["leaf-collection", "Leaf lineup", "Collect ten fallen leaves that are all different shapes and arrange them from smallest to largest.", "outdoors", 20, "easy", "outdoors", "medium", "free", "either", { safety: "Only pick up fallen leaves, and respect gardens and private property." }],
  ["new-route-walk", "Walk a new route", "Walk somewhere you go often but take a route you have never used. Notice three things you never knew were there.", "outdoors", 30, "easy", "outdoors", "medium", "free", "either", { featured: true, safety: OUTDOOR_NOTE }],
  ["sky-colour-log", "Sky colour log", "Step outside and describe the exact colour of the sky using three made-up paint names.", "outdoors", 5, "easy", "outdoors", "low", "free", "alone"],
  ["bird-count", "Ten-minute bird count", "Sit still outside for ten minutes and count every bird you see or hear. Try to identify one you didn't know.", "outdoors", 10, "easy", "outdoors", "low", "free", "either", { featured: true, safety: OUTDOOR_NOTE }],
  ["texture-rubbing", "Texture rubbings", "Take paper and a crayon or pencil outside and make rubbings of five different textures: bark, brick, grates, leaves.", "outdoors", 20, "easy", "outdoors", "low", "free", "either", { safety: "Only rub surfaces in public spaces or with permission." }],
  ["stargazing-constellation", "Find a constellation", "On a clear night, find one constellation you can name. Then invent your own from the stars nearby.", "outdoors", 20, "easy", "outdoors", "low", "free", "either", { safety: OUTDOOR_NOTE }],
  ["picnic-somewhere-new", "Picnic somewhere new", "Pack a simple snack and eat it somewhere outside you have never sat before.", "outdoors", 45, "easy", "outdoors", "low", "paid", "either", { safety: OUTDOOR_NOTE }],
  ["litter-pick", "Twenty-piece litter pick", "Take a bag and gloves and pick up 20 pieces of litter from a public place near you.", "outdoors", 20, "easy", "outdoors", "medium", "free", "either", { safety: "Wear gloves, skip anything sharp or hazardous, and stay away from traffic." }],
  ["shadow-tracing", "Trace a shadow", "Put an object on paper in the sun and trace its shadow. Come back in an hour and trace it again in another colour.", "outdoors", 10, "easy", "outdoors", "low", "free", "alone"],

  // ── Indoors ─────────────────────────────────────────────────────────────
  ["rearrange-one-shelf", "Rearrange one shelf", "Pick one shelf or drawer and rearrange it by colour, size or some rule only you understand.", "indoors", 15, "easy", "indoors", "low", "free", "alone"],
  ["blanket-fort", "Blanket fort", "Build a blanket fort big enough to sit inside, then do something in it: read, nap or plot world domination.", "indoors", 30, "easy", "indoors", "medium", "free", "either", { featured: true }],
  ["cook-pantry-challenge", "Pantry-only snack", "Make a snack using only five ingredients you already have. Give it a fancy restaurant name.", "indoors", 30, "medium", "indoors", "medium", "free", "either", { safety: "Take care with knives and heat." }],
  ["room-tour", "Museum tour of your room", "Give a guided tour of your room as if every object were a priceless museum exhibit.", "indoors", 10, "easy", "indoors", "medium", "free", "either"],
  ["candlelit-hour", "Unplugged hour", "Turn off every screen for one hour. Read, draw, tidy or just think.", "indoors", 60, "medium", "indoors", "low", "free", "alone"],
  ["indoor-garden", "Regrow a vegetable scrap", "Put the base of a spring onion, lettuce or celery in a little water on a windowsill and start a regrowth experiment.", "indoors", 10, "easy", "indoors", "low", "free", "alone"],
  ["sort-photos", "Favourite photo from each year", "Scroll back through your photos and choose one favourite from each year you have.", "indoors", 30, "easy", "anywhere", "low", "free", "alone"],
  ["fold-origami-crane", "Fold an origami crane", "Learn to fold a paper crane. Once you get one right, fold a second one without instructions.", "indoors", 25, "medium", "indoors", "low", "free", "alone"],

  // ── Gaming ──────────────────────────────────────────────────────────────
  ["three-rule-board-game", "Three-rule board game", "Invent a board game with exactly three rules, draw the board, and play one round.", "gaming", 30, "medium", "indoors", "low", "free", "either", { featured: true }],
  ["one-rule-game", "One-rule game", "Create a tiny game with one rule and one way to win. Play it at least twice.", "gaming", 15, "easy", "anywhere", "low", "free", "either"],
  ["speedrun-something", "Speedrun something boring", "Pick a daily task, like making the bed, and speedrun it. Record three attempts and try to beat your time.", "gaming", 10, "easy", "indoors", "high", "free", "either"],
  ["paper-pinball", "Paper pinball", "Design a pinball table on paper with a pen as the ball's path. Score your best run.", "gaming", 15, "easy", "anywhere", "low", "free", "alone"],
  ["dice-adventure", "Dice adventure", "Write six possible events for a hero, roll a die (or use a random number) six times and tell the story it creates.", "gaming", 20, "easy", "anywhere", "low", "free", "either"],
  ["browser-game-jam", "Make a game in one hour", "Use a free online tool like Scratch or Bitsy to make the smallest playable game you can in one hour.", "gaming", 60, "hard", "computer", "medium", "free", "alone", { featured: true }],
  ["tic-tac-toe-variant", "Tic-tac-toe, but weirder", "Invent a new twist on tic-tac-toe, such as a 4x4 grid or a third symbol, and play five rounds.", "gaming", 15, "easy", "anywhere", "low", "free", "with_friends"],
  ["retro-game-session", "Play a game older than you", "Find a free, legal browser version of a classic game released before you were born and play it for 20 minutes.", "gaming", 20, "easy", "computer", "low", "free", "alone"],
  ["word-chain-game", "Word chain", "Take turns saying a word that starts with the last letter of the previous word. No repeats. Last one standing wins.", "gaming", 10, "easy", "anywhere", "low", "free", "with_friends"],

  // ── Learn ───────────────────────────────────────────────────────────────
  ["hello-five-languages", "Hello in five languages", "Learn how to say hello in five languages you don't speak, including the correct pronunciation.", "learn", 10, "easy", "anywhere", "low", "free", "alone"],
  ["animal-fact", "One surprising animal fact", "Learn one genuinely surprising fact about an animal and explain it to someone in under 30 seconds.", "learn", 10, "easy", "computer", "low", "free", "alone"],
  ["learn-a-knot", "Learn a useful knot", "Learn to tie a bowline or a clove hitch. Practise until you can tie it with your eyes closed.", "learn", 15, "medium", "anywhere", "low", "free", "alone", { featured: true }],
  ["sign-language-alphabet", "Fingerspell your name", "Learn to fingerspell your name in a sign language used where you live.", "learn", 15, "easy", "computer", "low", "free", "alone"],
  ["wikipedia-random", "Random article rabbit hole", "Open a random encyclopedia article and follow links for 15 minutes. Summarise where you ended up in one sentence.", "learn", 15, "easy", "computer", "low", "free", "alone"],
  ["learn-a-card-trick", "Learn a card trick", "Learn a simple card trick and practise it until you can perform it smoothly.", "learn", 30, "medium", "indoors", "low", "free", "alone"],
  ["history-of-today", "On this day", "Look up three things that happened on today's date in history and pick the strangest.", "learn", 10, "easy", "computer", "low", "free", "alone"],
  ["explain-like-five", "Explain it to a five-year-old", "Pick something complicated you understand and explain it in three sentences a five-year-old could follow.", "learn", 10, "medium", "anywhere", "low", "free", "either"],
  ["learn-morse-sos", "Learn some Morse code", "Learn the Morse code for your initials and tap out a short message.", "learn", 15, "easy", "anywhere", "low", "free", "either"],
  ["identify-a-plant", "Identify a plant", "Find a plant near you and work out its name and one interesting fact about it.", "learn", 15, "easy", "anywhere", "low", "free", "alone", { safety: "Don't touch or taste plants you can't identify." }],
  ["read-a-poem-aloud", "Read a poem aloud", "Find a poem by a poet you've never read and read it out loud twice, slowly.", "learn", 10, "easy", "anywhere", "low", "free", "alone"],
  ["learn-keyboard-shortcuts", "Five new shortcuts", "Learn five keyboard shortcuts for an app you use every day and use each one three times.", "learn", 10, "easy", "computer", "low", "free", "alone"],

  // ── Mischief (harmless chaos) ───────────────────────────────────────────
  ["sports-commentator", "Sports commentator", "Narrate your next two minutes like a sports commentator. Every action deserves a replay.", "mischief", 2, "easy", "anywhere", "medium", "free", "either", { chaos: true, featured: true }],
  ["dramatic-object-backstory", "Dramatic object backstory", "Give an ordinary object near you a dramatic fictional backstory, complete with a tragic twist.", "mischief", 10, "easy", "anywhere", "low", "free", "either", { chaos: true }],
  ["ridiculous-holiday", "Invent a holiday", "Invent a ridiculous new holiday and three traditions people must follow to celebrate it.", "mischief", 10, "easy", "anywhere", "low", "free", "either", { featured: true, chaos: true }],
  ["toast-discovery", "The science of toast", "Explain how to make toast as if it were the most important scientific discovery of the century.", "mischief", 5, "easy", "anywhere", "low", "free", "either", { chaos: true }],
  ["nature-documentary-day", "Nature documentary narrator", "Describe your day so far as if you were narrating a nature documentary about a rare species: you.", "mischief", 5, "easy", "anywhere", "low", "free", "either", { chaos: true }],
  ["object-origin-story", "Object origin story", "Pick an everyday object and give it a fictional origin story: who invented it, and what went wrong.", "mischief", 10, "easy", "anywhere", "low", "free", "either", { chaos: true }],
  ["product-ad", "Ridiculous product ad", "Invent a ridiculous product and write its one-line advertisement. Bonus points for a jingle.", "mischief", 10, "easy", "anywhere", "low", "free", "either", { chaos: true }],
  ["villain-monologue", "Villain monologue", "Deliver a 30-second villain monologue about something mildly annoying, like slow Wi-Fi.", "mischief", 5, "easy", "anywhere", "medium", "free", "either", { chaos: true }],
  ["houseplant-interview", "Interview a houseplant", "Conduct a serious interview with a houseplant or object. Write down both the questions and its answers.", "mischief", 10, "easy", "indoors", "low", "free", "either", { chaos: true }],
  ["opposite-hand-hour", "Opposite hand challenge", "Use your non-dominant hand for everything for the next 15 minutes: writing, scrolling, eating.", "mischief", 15, "medium", "anywhere", "low", "free", "alone", { chaos: true }],
  ["dramatic-weather-report", "Overdramatic weather report", "Deliver today's weather forecast like breaking news of world-changing importance.", "mischief", 3, "easy", "anywhere", "medium", "free", "either", { chaos: true }],
  ["conspiracy-pet", "Gentle conspiracy theory", "Invent a harmless conspiracy theory about why socks go missing, with three pieces of 'evidence'.", "mischief", 10, "easy", "anywhere", "low", "free", "either", { chaos: true }],
  ["slow-motion-minute", "Slow-motion minute", "Do everything in exaggerated slow motion for one full minute, sound effects included.", "mischief", 2, "easy", "anywhere", "medium", "free", "either", { chaos: true }],
  ["royal-decree", "Royal decree", "Write a royal decree with five absurd laws for your household, then read it aloud in your grandest voice.", "mischief", 10, "easy", "indoors", "low", "free", "either", { chaos: true }],

  // ── Social ──────────────────────────────────────────────────────────────
  ["compliment-three", "Three specific compliments", "Send three people a genuine, specific compliment about something they did, not how they look.", "social", 10, "easy", "anywhere", "low", "free", "alone", { featured: true }],
  ["call-someone", "Call instead of text", "Call someone you usually only text and talk for at least five minutes.", "social", 10, "medium", "anywhere", "low", "free", "alone"],
  ["two-truths-lie", "Two truths and a lie", "Play two truths and a lie with friends or family. Make your lie wildly believable.", "social", 15, "easy", "anywhere", "low", "free", "with_friends"],
  ["thank-you-note", "Handwritten thank-you", "Write a short handwritten thank-you note to someone who helped you recently.", "social", 15, "easy", "anywhere", "low", "free", "alone"],
  ["question-jar", "Deep question round", "Ask a friend three questions you've never asked them before, and answer them yourself too.", "social", 20, "easy", "anywhere", "low", "free", "with_friends"],
  ["collaborative-story", "One sentence each", "Write a story with friends where everyone adds one sentence at a time. Stop at 20 sentences.", "social", 15, "easy", "anywhere", "low", "free", "with_friends"],
  ["recommend-swap", "Recommendation swap", "Swap one song, one book and one video recommendation with a friend, and try theirs today.", "social", 30, "easy", "anywhere", "low", "free", "with_friends"],
  ["charades-round", "Charades round", "Play five rounds of charades using only films that came out in the last five years.", "social", 20, "easy", "indoors", "high", "free", "with_friends"],
  ["board-game-cafe", "Visit a board game café", "Go to a board game café or library game night and try a game nobody in your group has played.", "social", 60, "easy", "indoors", "low", "paid", "with_friends"],

  // ── Music ───────────────────────────────────────────────────────────────
  ["new-song-rating", "Rate a song you've never heard", "Listen to a song you've never heard before, from a genre you rarely play, and rate it out of ten with one sentence of review.", "music", 5, "easy", "anywhere", "low", "free", "alone"],
  ["kitchen-percussion", "Kitchen percussion", "Make a beat using only kitchen objects like pots, spoons and jars. Record 30 seconds of it.", "music", 15, "easy", "indoors", "medium", "free", "either", { featured: true }],
  ["write-a-jingle", "Write a jingle", "Write a ten-second jingle for something in your fridge and sing it with confidence.", "music", 10, "easy", "anywhere", "low", "free", "either"],
  ["hum-to-identify", "Hum-to-guess", "Hum five songs to a friend and see how many they can guess. Then swap.", "music", 10, "easy", "anywhere", "low", "free", "with_friends"],
  ["playlist-of-a-mood", "Soundtrack for a feeling", "Make a five-song playlist for a very specific feeling, like 'finding money in an old coat'.", "music", 15, "easy", "computer", "low", "free", "alone"],
  ["learn-a-chord", "Learn three chords", "Learn three chords on any instrument (an online piano works) and play them in a loop.", "music", 20, "medium", "anywhere", "low", "free", "alone"],
  ["one-word-lyrics", "Rewrite a chorus", "Take the chorus of a song you know well and rewrite it about something completely mundane.", "music", 10, "easy", "anywhere", "low", "free", "either"],
  ["live-music-local", "See live local music", "Find a free or cheap local gig, open mic or busker this week and go listen.", "music", 60, "easy", "anywhere", "low", "paid", "either", { safety: OUTDOOR_NOTE }],

  // ── Productivity ────────────────────────────────────────────────────────
  ["two-minute-tasks", "Two-minute sweep", "Do every task on your mind that takes less than two minutes. Stop after 15 minutes.", "productivity", 15, "easy", "anywhere", "medium", "free", "alone"],
  ["inbox-ten", "Clear ten emails", "Reply to, file or delete exactly ten emails. No more, no fewer.", "productivity", 10, "easy", "computer", "low", "free", "alone"],
  ["desk-reset", "Desk reset", "Clear your desk completely, wipe it down, and put back only what you actually use.", "productivity", 15, "easy", "indoors", "medium", "free", "alone"],
  ["delete-screenshots", "Screenshot purge", "Delete 50 screenshots or duplicate photos you no longer need.", "productivity", 10, "easy", "anywhere", "low", "free", "alone"],
  ["plan-tomorrow", "Three things for tomorrow", "Write down the three things that would make tomorrow a good day, and when you'll do each.", "productivity", 5, "easy", "anywhere", "low", "free", "alone"],
  ["unsubscribe-five", "Unsubscribe from five", "Unsubscribe from five newsletters or notifications you always ignore.", "productivity", 10, "easy", "computer", "low", "free", "alone"],
  ["pomodoro-one", "One focused pomodoro", "Pick one task you've been avoiding and work on it for 25 focused minutes with your phone in another room.", "productivity", 25, "medium", "anywhere", "low", "free", "alone", { featured: true }],
  ["learn-spreadsheet-trick", "Spreadsheet trick", "Learn one spreadsheet formula you've never used and build a tiny sheet that uses it.", "productivity", 20, "medium", "computer", "low", "free", "alone"],
  ["password-check", "Security tune-up", "Turn on two-factor authentication for one important account that doesn't have it yet.", "productivity", 10, "easy", "computer", "low", "free", "alone"],
  ["wardrobe-five", "Five-item wardrobe edit", "Find five items of clothing you haven't worn in a year and decide whether to donate, repair or keep them.", "productivity", 20, "easy", "indoors", "medium", "free", "alone"],

  // ── A few harder ones for the ambitious ─────────────────────────────────
  ["learn-alphabet-new-script", "Learn a new alphabet", "Learn to read the letters of a writing system you don't know, such as Greek or Hangul, well enough to sound out a word.", "learn", 60, "hard", "anywhere", "low", "free", "alone"],
  ["write-short-story-1000", "1,000-word short story", "Write a complete short story of about 1,000 words with a beginning, middle and end. No editing until it's finished.", "creative", 60, "hard", "anywhere", "low", "free", "alone"],
  ["rubiks-one-face", "Solve one Rubik's cube face", "Learn how to solve one complete face of a Rubik's cube (or an online simulator).", "brain", 45, "hard", "anywhere", "low", "free", "alone"],
  ["memorise-pi", "Memorise 20 digits of pi", "Memorise the first 20 digits of pi using any trick you like, then recite them without looking.", "brain", 20, "hard", "anywhere", "low", "free", "alone"],
  ["stop-motion-film", "Ten-second stop-motion film", "Make a ten-second stop-motion animation with your phone and any small objects. Aim for at least 50 frames.", "creative", 60, "insane", "indoors", "low", "free", "either", { featured: true }],
  ["build-a-website", "Build a one-page website", "Make a one-page website about your favourite snack using any free editor, and get it online.", "productivity", 60, "insane", "computer", "medium", "free", "alone"],
  ["write-a-song", "Write a whole song", "Write a complete song with two verses and a chorus, and record a rough version on your phone.", "music", 60, "insane", "anywhere", "medium", "free", "either", { featured: true }],
  ["chaos-cooking-show", "Cooking show host", "Make a sandwich while hosting your own over-the-top cooking show. Introduce every ingredient like a celebrity guest.", "mischief", 15, "medium", "indoors", "high", "free", "either", { chaos: true, safety: "Take care with knives." }],
];

export const SEED_ACTIVITIES: SeedActivity[] = rows.map(
  ([slug, title, description, category, minutes, difficulty, location, energy, cost, people, flags]) => ({
    slug,
    title,
    description,
    category,
    duration_minutes: minutes,
    difficulty,
    location,
    energy_level: energy,
    cost_type: cost,
    people_type: people,
    xp_reward: XP_BY_DIFFICULTY[difficulty] + (flags?.chaos ? 5 : 0),
    is_chaos: flags?.chaos ?? false,
    is_featured: flags?.featured ?? false,
    safety_note: flags?.safety ?? null,
  }),
);

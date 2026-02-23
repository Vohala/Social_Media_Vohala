const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'vohala.db');
const db = new Database(DB_PATH);

// Enable WAL mode + performance tuning for 1000+ concurrent clients
db.pragma('journal_mode = WAL');       // concurrent reads + single writer
db.pragma('synchronous = NORMAL');     // safe with WAL, much faster than FULL
db.pragma('cache_size = -20000');      // 20 MB page cache
db.pragma('temp_store = MEMORY');      // temp tables in RAM
db.pragma('mmap_size = 268435456');    // 256 MB memory-mapped I/O
db.pragma('busy_timeout = 5000');      // wait up to 5s instead of SQLITE_BUSY
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT DEFAULT NULL,
      cover_photo TEXT DEFAULT NULL,
      bio TEXT DEFAULT '',
      location TEXT DEFAULT '',
      website TEXT DEFAULT '',
      work TEXT DEFAULT '',
      education TEXT DEFAULT '',
      relationship_status TEXT DEFAULT '',
      birthday TEXT DEFAULT '',
      is_verified INTEGER DEFAULT 0,
      is_online INTEGER DEFAULT 0,
      last_seen TEXT DEFAULT NULL,
      privacy_profile TEXT DEFAULT 'public',
      privacy_posts TEXT DEFAULT 'friends',
      privacy_messages TEXT DEFAULT 'everyone',
      notify_likes INTEGER DEFAULT 1,
      notify_comments INTEGER DEFAULT 1,
      notify_friend_requests INTEGER DEFAULT 1,
      notify_messages INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Posts table
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT DEFAULT '',
      feeling TEXT DEFAULT NULL,
      feeling_emoji TEXT DEFAULT NULL,
      location TEXT DEFAULT NULL,
      privacy TEXT DEFAULT 'friends',
      bg_color TEXT DEFAULT NULL,
      original_post_id INTEGER DEFAULT NULL,
      share_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (original_post_id) REFERENCES posts(id) ON DELETE SET NULL
    );

    -- Post media (multiple images/videos per post)
    CREATE TABLE IF NOT EXISTS post_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      media_type TEXT DEFAULT 'image',
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    -- Post tags
    CREATE TABLE IF NOT EXISTS post_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Post reactions
    CREATE TABLE IF NOT EXISTS post_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reaction_type TEXT NOT NULL DEFAULT 'like',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Comments
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      parent_id INTEGER DEFAULT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    );

    -- Comment reactions
    CREATE TABLE IF NOT EXISTS comment_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reaction_type TEXT NOT NULL DEFAULT 'like',
      UNIQUE(comment_id, user_id),
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Hashtags
    CREATE TABLE IF NOT EXISTS hashtags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT UNIQUE NOT NULL,
      post_count INTEGER DEFAULT 0
    );

    -- Post hashtags
    CREATE TABLE IF NOT EXISTS post_hashtags (
      post_id INTEGER NOT NULL,
      hashtag_id INTEGER NOT NULL,
      PRIMARY KEY (post_id, hashtag_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (hashtag_id) REFERENCES hashtags(id) ON DELETE CASCADE
    );

    -- Friendships (bidirectional)
    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, friend_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Friend requests
    CREATE TABLE IF NOT EXISTS friend_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(sender_id, receiver_id),
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Follows (follow without friending)
    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(follower_id, following_id),
      FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Blocks
    CREATE TABLE IF NOT EXISTS blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blocker_id INTEGER NOT NULL,
      blocked_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(blocker_id, blocked_id),
      FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Messages
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT DEFAULT '',
      media_url TEXT DEFAULT NULL,
      media_type TEXT DEFAULT NULL,
      is_read INTEGER DEFAULT 0,
      deleted_for_sender INTEGER DEFAULT 0,
      deleted_for_receiver INTEGER DEFAULT 0,
      deleted_for_everyone INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      actor_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      entity_id INTEGER DEFAULT NULL,
      entity_type TEXT DEFAULT NULL,
      message TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Stories
    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      story_type TEXT DEFAULT 'image',
      media_url TEXT DEFAULT NULL,
      content TEXT DEFAULT '',
      bg_color TEXT DEFAULT '#667eea',
      caption TEXT DEFAULT '',
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Story views
    CREATE TABLE IF NOT EXISTS story_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      viewed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(story_id, user_id),
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Story reactions
    CREATE TABLE IF NOT EXISTS story_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reaction_type TEXT DEFAULT 'like',
      UNIQUE(story_id, user_id),
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Groups
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      cover_photo TEXT DEFAULT NULL,
      privacy TEXT DEFAULT 'public',
      creator_id INTEGER NOT NULL,
      member_count INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Group members
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at TEXT DEFAULT (datetime('now')),
      UNIQUE(group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Group posts
    CREATE TABLE IF NOT EXISTS group_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    -- Events
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      cover_photo TEXT DEFAULT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT DEFAULT NULL,
      location TEXT DEFAULT '',
      is_online INTEGER DEFAULT 0,
      privacy TEXT DEFAULT 'public',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Event responses
    CREATE TABLE IF NOT EXISTS event_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      response TEXT NOT NULL,
      UNIQUE(event_id, user_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Marketplace items
    CREATE TABLE IF NOT EXISTS marketplace_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      condition TEXT DEFAULT 'good',
      category TEXT DEFAULT 'other',
      location TEXT DEFAULT '',
      is_sold INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Marketplace item photos
    CREATE TABLE IF NOT EXISTS marketplace_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (item_id) REFERENCES marketplace_items(id) ON DELETE CASCADE
    );

    -- Saved posts
    CREATE TABLE IF NOT EXISTS saved_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      saved_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );
  `);

  console.log('✅ Database schema initialized');
  seedDemoData();
}

function seedDemoData() {
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existingUsers.count > 0) {
    console.log('✅ Database already seeded');
    return;
  }

  console.log('🌱 Seeding demo data...');

  const hashedPassword = bcrypt.hashSync('demo123', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (name, username, email, password, bio, location, work, education, birthday, is_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const users = [
    { name: 'Rahul Sharma', username: 'rahul_sharma', email: 'rahul@demo.com', bio: 'Software Engineer | Coffee lover ☕ | Travel enthusiast 🌍', location: 'Bengaluru, Karnataka', work: 'Senior Developer at TechCorp', education: 'IIT Bombay', birthday: '1995-03-15', verified: 1 },
    { name: 'Priya Patel', username: 'priya_patel', email: 'priya@demo.com', bio: 'Designer & Artist 🎨 | Making the world beautiful one pixel at a time', location: 'Mumbai, Maharashtra', work: 'UI/UX Designer at StartupHub', education: 'NID Ahmedabad', birthday: '1997-07-22', verified: 0 },
    { name: 'Amit Kumar', username: 'amit_kumar', email: 'amit@demo.com', bio: 'Entrepreneur | Startup founder | Making things happen 🚀', location: 'Delhi, NCR', work: 'CEO at InnovateTech', education: 'Delhi University', birthday: '1993-11-08', verified: 1 },
    { name: 'Neha Singh', username: 'neha_singh', email: 'neha@demo.com', bio: 'Doctor | Health activist | Yoga practitioner 🧘‍♀️', location: 'Pune, Maharashtra', work: 'Doctor at Apollo Hospital', education: 'AIIMS Delhi', birthday: '1996-05-30', verified: 0 },
    { name: 'Kiran Reddy', username: 'kiran_reddy', email: 'kiran@demo.com', bio: 'Data Scientist | ML enthusiast | Cricket fan 🏏', location: 'Hyderabad, Telangana', work: 'Data Scientist at Analytics Co', education: 'IIT Hyderabad', birthday: '1994-09-12', verified: 0 },
  ];

  const userIds = [];
  for (const u of users) {
    const result = insertUser.run(u.name, u.username, u.email, hashedPassword, u.bio, u.location, u.work, u.education, u.birthday, u.verified);
    userIds.push(result.lastInsertRowid);
  }

  // Create friendships between all demo users
  const insertFriendship = db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)');
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      insertFriendship.run(userIds[i], userIds[j]);
      insertFriendship.run(userIds[j], userIds[i]);
    }
  }

  // Create posts
  const insertPost = db.prepare(`
    INSERT INTO posts (user_id, content, feeling, feeling_emoji, location, privacy, bg_color, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ? || ' hours'))
  `);

  const posts = [
    { uid: userIds[0], content: "Just deployed a new feature to production! 🚀 The feeling of seeing your code live is unmatched. #coding #developer #buildinginpublic", feeling: 'excited', emoji: '🤩', loc: 'Bengaluru, Karnataka', privacy: 'public', bg: null, hoursAgo: '-5' },
    { uid: userIds[1], content: "Working on some new UI designs today. Color theory is such a fascinating subject! 🎨✨ #design #uidesign #creativity", feeling: 'creative', emoji: '🎨', loc: null, privacy: 'public', bg: null, hoursAgo: '-8' },
    { uid: userIds[2], content: "Big announcement coming next week! 🔥 Stay tuned. The journey of building something from scratch is incredible. #startup #entrepreneur #buildingindia", feeling: 'excited', emoji: '🤩', loc: 'Delhi, NCR', privacy: 'public', bg: null, hoursAgo: '-12' },
    { uid: userIds[3], content: "Mental health matters! 💚 Taking breaks, practicing mindfulness, and staying connected with loved ones are as important as physical health. #health #wellness #mindfulness", feeling: 'grateful', emoji: '🙏', loc: null, privacy: 'public', bg: null, hoursAgo: '-3' },
    { uid: userIds[4], content: "India vs Australia match today! 🏏🇮🇳 Can't wait! Who's watching? #cricket #indvaus #TeamIndia", feeling: 'excited', emoji: '🤩', loc: 'Hyderabad', privacy: 'public', bg: null, hoursAgo: '-2' },
    { uid: userIds[0], content: "Beautiful morning in Bengaluru! ☀️ Nothing beats a good cup of filter coffee to start the day. #bengaluru #filtercoffee #morningvibes", feeling: 'happy', emoji: '😊', loc: 'Bengaluru', privacy: 'friends', bg: null, hoursAgo: '-24' },
    { uid: userIds[1], content: "Life is too short for boring designs! 💫", feeling: null, emoji: null, loc: null, privacy: 'public', bg: '#667eea', hoursAgo: '-48' },
    { uid: userIds[2], content: "Networking is not about what you know, it's about who you know AND who knows you. Build genuine relationships. 🤝 #networking #business #india", feeling: 'inspired', emoji: '💡', loc: null, privacy: 'public', bg: null, hoursAgo: '-36' },
    { uid: userIds[3], content: "Yoga session done! 🧘‍♀️ Starting the day with mindfulness sets the tone for everything that follows. Join me for online sessions this weekend! #yoga #wellness #mindfulness", feeling: 'peaceful', emoji: '😌', loc: 'Pune', privacy: 'public', bg: null, hoursAgo: '-6' },
    { uid: userIds[4], content: "Just built a machine learning model that predicts cricket match outcomes! 🏏🤖 Accuracy: 78%. Working on improving it! #machinelearning #cricket #python #datascience", feeling: 'accomplished', emoji: '🏆', loc: null, privacy: 'public', bg: null, hoursAgo: '-10' },
  ];

  const postIds = [];
  for (const p of posts) {
    const result = insertPost.run(p.uid, p.content, p.feeling, p.emoji, p.loc, p.privacy, p.bg, p.hoursAgo);
    postIds.push(result.lastInsertRowid);
  }

  // Add reactions to posts
  const insertReaction = db.prepare('INSERT OR IGNORE INTO post_reactions (post_id, user_id, reaction_type) VALUES (?, ?, ?)');
  const reactionTypes = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

  for (let i = 0; i < postIds.length; i++) {
    const numReactions = Math.floor(Math.random() * 4) + 1;
    const shuffled = [...userIds].sort(() => 0.5 - Math.random());
    for (let j = 0; j < Math.min(numReactions, shuffled.length); j++) {
      if (shuffled[j] !== posts[i].uid) {
        const rt = reactionTypes[Math.floor(Math.random() * 3)];
        insertReaction.run(postIds[i], shuffled[j], rt);
      }
    }
  }

  // Add comments
  const insertComment = db.prepare(`
    INSERT INTO comments (post_id, user_id, content, created_at)
    VALUES (?, ?, ?, datetime('now', ? || ' hours'))
  `);

  const commentData = [
    { pid: postIds[0], uid: userIds[1], text: "Congratulations! 🎉 Shipping code is the best feeling!", hoursAgo: '-4' },
    { pid: postIds[0], uid: userIds[2], text: "Keep building! 🚀", hoursAgo: '-3' },
    { pid: postIds[1], uid: userIds[0], text: "Your designs are always so clean and beautiful! 😍", hoursAgo: '-7' },
    { pid: postIds[2], uid: userIds[4], text: "Can't wait for the announcement! 🔥", hoursAgo: '-11' },
    { pid: postIds[3], uid: userIds[0], text: "So true! Mental health is often overlooked. Thank you for spreading awareness 💚", hoursAgo: '-2' },
    { pid: postIds[4], uid: userIds[0], text: "India all the way! 🏏🇮🇳", hoursAgo: '-1' },
    { pid: postIds[4], uid: userIds[2], text: "This is going to be an epic match!", hoursAgo: '-1' },
  ];

  for (const c of commentData) {
    insertComment.run(c.pid, c.uid, c.text, c.hoursAgo);
  }

  // Create stories (expires in 24 hours)
  const insertStory = db.prepare(`
    INSERT INTO stories (user_id, story_type, content, bg_color, caption, expires_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '+24 hours'))
  `);

  insertStory.run(userIds[0], 'text', 'Good morning Bengaluru! ☀️', '#667eea', '');
  insertStory.run(userIds[1], 'text', 'Working on something amazing today! 🎨', '#f093fb', '');
  insertStory.run(userIds[2], 'text', 'Big things coming! Stay tuned 🚀', '#4facfe', '');
  insertStory.run(userIds[3], 'text', 'Health is wealth! 💚', '#43e97b', '');
  insertStory.run(userIds[4], 'text', 'Cricket time! 🏏', '#fa709a', '');

  // Create groups
  const insertGroup = db.prepare(`
    INSERT INTO groups (name, description, privacy, creator_id, member_count)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertGroupMember = db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)');

  const group1 = insertGroup.run('India Tech Community', 'For all tech enthusiasts in India! Share your projects, get feedback, and connect with fellow developers.', 'public', userIds[0], 3);
  insertGroupMember.run(group1.lastInsertRowid, userIds[0], 'admin');
  insertGroupMember.run(group1.lastInsertRowid, userIds[2], 'member');
  insertGroupMember.run(group1.lastInsertRowid, userIds[4], 'member');

  const group2 = insertGroup.run('Design & Creative Arts', 'A space for designers, artists, and creative professionals to share work and inspiration.', 'public', userIds[1], 2);
  insertGroupMember.run(group2.lastInsertRowid, userIds[1], 'admin');
  insertGroupMember.run(group2.lastInsertRowid, userIds[0], 'member');

  const group3 = insertGroup.run('Health & Wellness India', 'Promoting healthy lifestyle, fitness, and mental wellbeing in India.', 'public', userIds[3], 3);
  insertGroupMember.run(group3.lastInsertRowid, userIds[3], 'admin');
  insertGroupMember.run(group3.lastInsertRowid, userIds[1], 'member');
  insertGroupMember.run(group3.lastInsertRowid, userIds[4], 'member');

  // Create events
  const insertEvent = db.prepare(`
    INSERT INTO events (creator_id, title, description, start_date, end_date, location, privacy)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEventResponse = db.prepare('INSERT OR IGNORE INTO event_responses (event_id, user_id, response) VALUES (?, ?, ?)');

  const event1 = insertEvent.run(userIds[0], 'Bengaluru Tech Meetup 2026', 'Monthly tech meetup for developers, designers and entrepreneurs in Bengaluru. Network, learn and grow!', '2026-03-15 18:00:00', '2026-03-15 21:00:00', 'Koramangala, Bengaluru', 'public');
  insertEventResponse.run(event1.lastInsertRowid, userIds[0], 'going');
  insertEventResponse.run(event1.lastInsertRowid, userIds[2], 'going');
  insertEventResponse.run(event1.lastInsertRowid, userIds[4], 'interested');

  const event2 = insertEvent.run(userIds[3], 'Free Yoga Session - Pune', 'Free outdoor yoga session for everyone! Bring your mat and positive energy.', '2026-03-01 07:00:00', '2026-03-01 08:30:00', 'Baner, Pune', 'public');
  insertEventResponse.run(event2.lastInsertRowid, userIds[3], 'going');
  insertEventResponse.run(event2.lastInsertRowid, userIds[1], 'going');

  // Create marketplace items
  const insertItem = db.prepare(`
    INSERT INTO marketplace_items (seller_id, title, description, price, condition, category, location)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertItem.run(userIds[0], 'MacBook Pro 14" M3 (2024)', 'Excellent condition MacBook Pro. Used for 6 months. Comes with original charger and box. Perfect for developers.', 120000, 'like_new', 'electronics', 'Bengaluru, Karnataka');
  insertItem.run(userIds[1], 'Wacom Intuos Pro Tablet', 'Professional drawing tablet, size medium. Great for digital artists and designers. Includes pen and extra nibs.', 15000, 'good', 'electronics', 'Mumbai, Maharashtra');
  insertItem.run(userIds[2], 'Herman Miller Aeron Chair', 'Premium ergonomic office chair. Size B. Perfect for long work sessions. Minor scuffs on armrests.', 45000, 'good', 'furniture', 'Delhi, NCR');
  insertItem.run(userIds[4], 'Python Data Science Books Bundle', 'Collection of 5 data science and ML books. Covers Python, Pandas, Scikit-learn, TensorFlow. Like new condition.', 3500, 'like_new', 'books', 'Hyderabad, Telangana');

  // Add some notifications
  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, actor_id, type, entity_id, entity_type, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertNotif.run(userIds[0], userIds[1], 'reaction', postIds[0], 'post', 'Priya Patel reacted to your post');
  insertNotif.run(userIds[0], userIds[2], 'comment', postIds[0], 'post', 'Amit Kumar commented on your post');
  insertNotif.run(userIds[1], userIds[0], 'reaction', postIds[1], 'post', 'Rahul Sharma reacted to your post');
  insertNotif.run(userIds[2], userIds[4], 'comment', postIds[2], 'post', 'Kiran Reddy commented on your post');

  // Add some messages
  const insertMsg = db.prepare(`
    INSERT INTO messages (sender_id, receiver_id, content, created_at)
    VALUES (?, ?, ?, datetime('now', ? || ' minutes'))
  `);

  insertMsg.run(userIds[1], userIds[0], 'Hey Rahul! How is the new project going?', '-30');
  insertMsg.run(userIds[0], userIds[1], 'Going great! Almost done with the backend. How about your designs?', '-25');
  insertMsg.run(userIds[1], userIds[0], 'Looks amazing! Send me a sneak peek when ready 😊', '-20');
  insertMsg.run(userIds[0], userIds[1], 'Will do! Check out the latest design mockups on my profile!', '-15');

  insertMsg.run(userIds[2], userIds[0], 'Rahul bhai, are you coming to the tech meetup?', '-60');
  insertMsg.run(userIds[0], userIds[2], 'Definitely! Already registered. See you there 🤝', '-55');

  console.log('✅ Demo data seeded successfully');
  console.log('📧 Demo accounts: rahul@demo.com, priya@demo.com, amit@demo.com, neha@demo.com, kiran@demo.com');
  console.log('🔑 Password: demo123');
}

module.exports = { db, initDatabase };

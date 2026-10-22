const path = require("path");
// 🚨 Tell dotenv to look one folder up (in the server root) for the .env file
require("dotenv").config({ path: path.join(__dirname, "../.env") }); 
const mongoose = require("mongoose");

// 🚨 Import your existing DB connection module
require("../db/conn"); 

// Import the new Blog model
const Blog = require("../models/blogSchema");

const legacyBlogs = [
  {
    title: "Why don't children enjoy festivals and family gatherings anymore?",
    summary: "“Why won’t my child play Holi with me?”<br>\n“They never want to attend weddings anymore.”<br>\n“Why wont my child talk to guests when they visit?”<br>",
    content: "<p class='mb-4'>\nA parent recently shared this concern with me.<br>\n<br>\nDuring festivals or family gatherings, their child would avoid interactions, stay in their room, or scroll on their phone while everyone else socialised.<br>\n<br>\nOn the surface, it does sound like the child is being rude.<br>\nDisobeying their parents, staying on their phone by themselves while a room full of people are thriving.<br>\n<br>\nBut most of the time, that isn’t the intention.<br>\n<br>\nYour child isn’t being disrespectful.<br>\nThey’re mentally exhausted.<br>\n<br>\nIn India, the wedding and festive season often overlaps with the final/board exam season.<br>\n<br>\nYou may be preparing to attend a wedding today, while your child is preparing for an exam the very next morning.<br>\nJust as families plan celebrations, students are managing exams, tests, assignments, projects, coaching, sleep schedules, health, and expectations, all at once.<br>\n<br>\nWith this constant load, many students begin to feel mentally divided.<br>\n<br>\nUnlike adults, children often struggle to juggle multiple priorities simultaneously.<br>\nAnd exams themselves aren’t limited to one subject; students prepare for five or six subjects at the same time, alongside extracurricular and internal assessments.<br>\n<br>\nAs students move to higher classes, this pressure only increases.<br>\n<br>\nI’m not suggesting that children shouldn’t study or that festivals shouldn’t be celebrated.<br>\n<br>\nBut parents should recognise that their child may already be overwhelmed.<br>\n<br>\nIf a child is physically present at a function but mentally preoccupied with unfinished syllabus or upcoming exams, are they really celebrating?<br>\n<br>\nAs parents, you may not always be able to help academically.<br>\nBut there is one powerful thing you can do:<br>\n<br>\nTalk.<br>\n<br>\nNot about marks.<br>\nNot about results or career scope.<br>\n<br>\nAsk how they’re feeling.<br>\nAsk what feels difficult right now.<br>\nAsk whether they’re coping okay.<br>\n<br>\nEven small, judgment-free conversations can make a lasting difference.<br>\nThey remind children that they are not alone, that someone understands the mental load they carry every day.<br>\n<br>\nAnd to any student reading this:<br>\nIf this season feels overwhelming, know that what you’re feeling is valid.<br>\nYou’re trying to balance more than people often realise and you don’t have to go through it alone.<br>\n<br>\nThis Holi, may we celebrate not just togetherness, but also understanding the silent pressures our children carry.<br>\n<br>\nWishing you all a very Happy Holi 😊<br>\n#HappyHoli #ExamSeason #Boards\n</p>",
    coverImage: "https://res.cloudinary.com/da6jhcsmm/image/upload/v1772979190/holi_blog_fxqtcy.jpg",
    publishedAt: new Date("March 4, 2026"),
    authorName: "Lavish Sharma",
    category: "Academic Pressure"
  },
  {
    title: "Are we pushing our children too hard?",
    summary: "Want to know the secret to winning gold at the Olympics?",
    content: "<p class='mb-4'>\nThe secret is being joyful.<br>\nJust like Alysa Liu.<br>\n<br>\nAlysa Liu is an American figure skater. She is the 2026 Winter Olympic champion in both women's singles and in the team event.<br>\n<br>\nAlysa Liu has been going viral all over the internet not just because of her win, but because of how she approached such a major competition like The Olympics.<br>\n<br>\nInstead of burning herself out for the sake of discipline, or attaching her entire identity to winning, she focused on valuing the process of preparing and took joy in just being present.<br>\nAnd that joy allowed her to perform at her best.<br>\n<br>\nNow instead of the Olympics, think about board exams in India.<br>\n<br>\nIn India, 46 lakh students prepare for board exams every year.<br>\n<br>\nEveryone wants to pass. Everyone wants to top.<br>\n<br>\nAnd with so much pressure to perform, students stop studying to understand and start studying just to survive the exam.<br>\nAnd it takes a toll on them.<br>\n<br>\nA survey by NCERT revealed that over 80% of Indian students in classes 9-12 suffer from anxiety due to exams and results.<br>\n<br>\nBut what if just like Alysa Liu, your child could enjoy the process of studying?<br>\n<br>\nInstead of studying for hours and still struggling in exams.<br>\nInstead of memorizing entire chapters but not truly understanding them.<br>\n<br>\nMany children today are not struggling because they are incapable.<br>\nThey struggle because they feel no real connection with what they are studying.<br>\n<br>\nChildren are often told what to study, how to study, and when to study.<br>\nBut rarely why it actually matters.<br>\n<br>\nAnd when children feel curious about what they are learning, when they are allowed to ask questions, and when they feel some ownership over the process, learning stops feeling like pressure and starts becoming something they can grow through.<br>\n<br>\nBecause sometimes the difference between pressure and performance is not more discipline.<br>\nIt is building a healthier relationship with learning itself and staying connected to the joy of the process.\n</p>",
    coverImage: "https://res.cloudinary.com/da6jhcsmm/image/upload/v1775561409/Alysa-Liu-ISU-World-Championships-032825-30ecb4e95b0c426e9c84a0e3903b5fdb_tcjof6.jpg",
    publishedAt: new Date("March 6, 2026"),
    authorName: "Disha Audichya",
    category: "Academic Pressure"
  }
];

const syncLegacyBlogs = async () => {
  try {
    console.log("Connecting to Database...");

    // Wait for the mongoose connection to be ready from your conn.js file
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => mongoose.connection.once("open", resolve));
    }
    
    console.log("Connected successfully! Starting sync...");

    // Wipe existing blogs if you want a clean slate (Optional - uncomment if needed)
    // await Blog.deleteMany({});
    
    // Inject the blogs
    const result = await Blog.insertMany(legacyBlogs);
    
    console.log(`✅ Migration Complete! Successfully injected ${result.length} legacy blogs.`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Sync failed with error:", error);
    process.exit(1);
  }
};

syncLegacyBlogs();

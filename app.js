const fs = require("fs");
const { shorten } = require("tinyurl");
const { IgApiClient } = require("instagram-private-api");
const { WebhookClient } = require("discord.js");
const axios = require("axios");
const shortid = require("shortid");
const dotenv = require("dotenv");
dotenv.config();

// Instagram credentials
const username = "";
const password = "";

// Discord webhook URL
const discordWebhookURL = process.env.DISCORD;

// Array of friend usernames
const friendUsernames = ["p1", "p2", "p3"];

// Create a new instance of the Instagram API client
const ig = new IgApiClient();

// Path to the JSON file to store sent story IDs
const sentStoriesFilePath = "sentStories.json";

// Initialize the client
(async () => {
  ig.state.generateDevice(username);

  try {
    // Log in to Instagram
    await ig.account.login(username, password);

    // Load sent story IDs from the JSON file
    let sentStories = loadSentStories();

    while (true) {
      for (const friendUsername of friendUsernames) {
        // Get the friend's user ID
        const { pk } = await ig.user.searchExact(friendUsername);

        // Get the friend's stories
        const storyItems = await ig.feed.userStory(pk).items();

        // Process or save the story items as needed
        console.log(
          `Downloaded ${storyItems.length} stories for user: ${friendUsername}`
        );

        // Filter out already sent stories
        const newStories = storyItems.filter(
          (storyItem) => !sentStories.includes(storyItem.id)
        );

        // Send new stories to Discord
        for (const storyItem of newStories) {
          const username = storyItem.user.username;
          const caption = `New story from ${username} on Instagram`;
          let mediaUrl;
          if (storyItem.media_type === 1) {
            // Image
            mediaUrl = storyItem.image_versions2.candidates[0].url;
          } else if (storyItem.media_type === 2) {
            // Video
            mediaUrl = storyItem.video_versions[0].url;
          }
          if (mediaUrl) {
            const shortLink = generateShortLink(mediaUrl);
            await sendToDiscord(mediaUrl, caption, shortLink);
            // Add sent story IDs to the array
            sentStories.push(storyItem.id);
          }
        }

        // Save sent story IDs to the JSON file
        saveSentStories(sentStories);
      }

      // Delay before checking for new stories again (10 minutes)
      await sleep(600000); // 10 minutes
    }
  } catch (error) {
    if (error.name === "IgNoCheckpointError") {
      console.error("No checkpoint data available. Retrying login...");
      await retryLogin();
    } else {
      console.error("An error occurred while accessing Instagram:", error);
    }
  }
})();

// Retry the login process
async function retryLogin() {
  try {
    // Delay for a few seconds before retrying
    await sleep(5000);

    // Log in to Instagram again
    await ig.account.login(username, password);

    console.log("Login successful after retry.");

    // Reset sentStories array
    resetSentStories();

    // Continue with the rest of the code

    // ...
  } catch (error) {
    console.error("An error occurred during login retry:", error);
  }
}

// Send story to Discord using a webhook
async function sendToDiscord(mediaUrl, caption) {
  try {
    const discordClient = new WebhookClient({ url: discordWebhookURL });

    const mediaResponse = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
    });

    const mediaBuffer = mediaResponse.data;

    const attachment = {
      attachment: mediaBuffer,
      name: mediaUrl.split("/").pop(),
    };

    const shortLink = await shorten(mediaUrl);

    await discordClient.send({
      files: [attachment],
      content: `${caption}\n${shortLink}`,
    });

    console.log("Story sent to Discord successfully.");
  } catch (error) {
    console.error("An error occurred while sending story to Discord:", error);
  }
}

// Generate a short link using shortid library
function generateShortLink(url) {
  const shortCode = shortid.generate();
  return `https://your-short-domain/${shortCode}`;
}

// Utility function to sleep for a given number of milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Load sent story IDs from the JSON file
function loadSentStories() {
  try {
    const fileContent = fs.readFileSync(sentStoriesFilePath, "utf8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error("Failed to load sentStories from JSON file:", error);
    return [];
  }
}

// Save sent story IDs to the JSON file
function saveSentStories(sentStories) {
  try {
    const jsonData = JSON.stringify(sentStories);
    fs.writeFileSync(sentStoriesFilePath, jsonData, "utf8");
  } catch (error) {
    console.error("Failed to save sentStories to JSON file:", error);
  }
}

// Reset the sentStories array and remove the JSON file
function resetSentStories() {
  sentStories = [];
  try {
    fs.unlinkSync(sentStoriesFilePath);
    console.log("Sent stories reset and JSON file removed.");
  } catch (error) {
    console.error("Failed to reset sentStories and remove JSON file:", error);
  }
}

const { publishToLinkedIn } = require('./linkedinPublisher');
const { publishToFacebook } = require('./facebookPublisher');
// const { publishToInstagram } = require('./instagramPublisher');

module.exports = {
  publishToLinkedIn,
  publishToFacebook,
  // publishToInstagram
};
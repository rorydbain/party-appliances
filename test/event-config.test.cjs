const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanEventProfile } = require('../src/event-config.cjs');

test('event profiles are generic and offline by default', () => {
  assert.deepEqual(cleanEventProfile(), {
    eventName: 'Your event', venue: '', eventSlug: '', publicUrl: '', liveFeedUrl: '', receiptTitle: 'YOUR EVENT', receiptVenue: ''
  });
});

test('event profile derives a booth feed from its public gallery', () => {
  const profile = cleanEventProfile({ eventName: 'Alex + Sam', venue: 'Town Hall', eventSlug: 'alex-sam-party', publicUrl: 'https://photos.example.com/' });
  assert.equal(profile.liveFeedUrl, 'https://photos.example.com/api/events/alex-sam-party/photos');
  assert.equal(profile.receiptTitle, 'ALEX + SAM');
  assert.equal(profile.receiptVenue, 'TOWN HALL');
});

test('event profiles reject unsafe service addresses and slugs', () => {
  const profile = cleanEventProfile({ eventSlug: '../party', publicUrl: 'file:///tmp/photos', liveFeedUrl: 'javascript:alert(1)' });
  assert.equal(profile.eventSlug, ''); assert.equal(profile.publicUrl, ''); assert.equal(profile.liveFeedUrl, '');
});

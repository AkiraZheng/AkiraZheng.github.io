'use strict';

var algoliasearch = require('algoliasearch');
var crypto = require('crypto');
var fs = require('fs');
var yaml = require('js-yaml');

function computeSha1(text) {
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex');
}

var config = yaml.load(fs.readFileSync('./_config.yml', 'utf8'));
var algoliaConfig = config.algolia;

var applicationID = algoliaConfig.applicationID;
var apiKey = algoliaConfig.adminApiKey;
var indexName = algoliaConfig.indexName;

console.log('[algolia] App ID:', applicationID, 'Index:', indexName);

var client = algoliasearch(applicationID, apiKey);
var index = client.initIndex(indexName);

var Hexo = require('hexo');
var hexo = new Hexo('.', { silent: true });

hexo.init()
  .then(function() { return hexo.load(); })
  .then(function() {
    var posts = hexo.database.model('Post').find({ published: true });
    return posts.toArray();
  })
  .then(function(publishedPosts) {
    console.log('[algolia] Found', publishedPosts.length, 'posts');
    var records = publishedPosts.map(function(data) {
      var record = {
        title: data.title || '',
        date: data.date,
        updated: data.updated,
        slug: data.slug || '',
        excerpt: data.excerpt || '',
        permalink: (data.permalink || '').replace(/\/index\.html$/, '/'),
        layout: data.layout || '',
        content: (data.content || '').replace(/<[^>]*>/g, '').substring(0, 3000),
        objectID: computeSha1(data.path || data._id)
      };
      record.date_as_int = Date.parse(data.date) / 1000;
      record.updated_as_int = data.updated ? Date.parse(data.updated) / 1000 : 0;
      if (data.categories && (Array.isArray(data.categories) || typeof data.categories.toArray === 'function')) {
        record.categories = (data.categories.toArray ? data.categories.toArray() : data.categories).map(function(item) {
          return { name: item.name || '', path: item.path || '' };
        });
      }
      if (data.tags && (Array.isArray(data.tags) || typeof data.tags.toArray === 'function')) {
        record.tags = (data.tags.toArray ? data.tags.toArray() : data.tags).map(function(item) {
          return { name: item.name || '', path: item.path || '' };
        });
      }
      return record;
    });
    return index.clearIndex().then(function() { return records; });
  })
  .then(function(records) {
    console.log('[algolia] Uploading', records.length, 'records...');
    return index.saveObjects(records);
  })
  .then(function(result) {
    console.log('[algolia] Success! Indexed', result.objectIDs.length, 'records');
    process.exit(0);
  })
  .catch(function(err) {
    console.error('[algolia] Error:', err.message);
    process.exit(1);
  });

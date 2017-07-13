const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Storage = require('@google-cloud/storage');
const Vision = require('@google-cloud/vision');
const co = require('co');
const request = require('request-promise');

admin.initializeApp(functions.config().firebase);

const storage = Storage();
const vision = Vision();

exports.initializeUser = functions.auth.user().onCreate(event => {
    const user = event.data;

    const updates = {};
    updates[`users/${user.uid}`] = {
        uid: user.uid,
        email: user.email
    }

    return admin.database().ref().update(updates);
});

exports.cleanupUser = functions.auth.user().onDelete(event => {
    const user = event.data;

    const updates = {};
    updates[`users/${user.uid}`] = null;

    return admin.database().ref().update(updates);
});

exports.randomLanguage = functions.database.ref('users/{userID}').onWrite(event => {
    const snapshot = event.data;
    if (snapshot.previous.exists()) {
        return;
    }

    if (!snapshot.exists()) {
        return;
    }

    const languages = ['en', 'es', 'fr', 'it', 'jp'];
    const random = Math.floor(Math.random() * (languages.length));

    return snapshot.ref.child('language').set(languages[random]);
});

// Translate an incoming message.
exports.translate = functions.database.ref('/projectMessageBoards/{projectID}/{messageID}/').onWrite(event => {
    const snapshot = event.data;
    const isDelete = snapshot.previous.exists && !snapshot.current.exists;
    if (snapshot.val().translated || isDelete) {
        return;
    }

    return co(translateMessage(snapshot, event.params.projectID));
});

function* translateMessage(snapshot, projectID) {
    console.log(`/projectMembers/${projectID}`);
    const membersRef = admin.database().ref(`/projectMembers/${projectID}`);
    const membersSnapshot = yield membersRef.once('value');

    if (!membersSnapshot.exists()) {
        return
    }

    let languages = [];
    let fromLanguage = snapshot.val().language;
    membersSnapshot.forEach(member => {
        languages.push(member.val().language)});

    let uniqueLanguages = [...new Set(languages)];
    uniqueLanguages = uniqueLanguages.filter(language => language !== fromLanguage);

    const message = snapshot.val().message
    const translationResponses = yield uniqueLanguages.map(targetLanguage => {
        console.log(`Translate message: ${message} from ${fromLanguage} to ${targetLanguage}`);
        let url = createTranslateUrl(fromLanguage, targetLanguage, message);
        return request(url, { resolveWithFullResponse: true });
    });

    const invalidResponses = translationResponses.filter(response => response.statusCode !== 200);
    if (invalidResponses.length > 0) {
        console.log('something went wrong');
        return
    }

    const updates = {}
    updates['translated'] = true;
    updates['translations'] = translationResponses.reduce(function (prev, current, index) {
        let translatedText = JSON.parse(current.body).data.translations[0].translatedText;
        prev[`${uniqueLanguages[index]}`] = translatedText;
        return prev;
    }, {});

    return snapshot.adminRef.update(updates);
}

// URL to the Google Translate API.
function createTranslateUrl(source, target, payload) {
    return `https://www.googleapis.com/language/translate/v2?key=${functions.config().firebase.apiKey}&source=${source}&target=${target}&q=${payload}`;
}

exports.smartImages = functions.storage.object().onChange(event => {
    const object = event.data; // The Storage object.

    const fileBucket = object.bucket; // The Storage bucket that contains the file.
    const fileName = object.name; // File path in the bucket.
    const metadata = object.metadata;
    const contentType = object.contentType; // File content type.
    const resourceState = object.resourceState; // The resourceState is 'exists' or 'not_exists' (for file/folder deletions).
    const metageneration = object.metageneration; // Number of times metadata has been generated. New objects have a value of 1.

    console.log('--------------------');
    console.log(fileName);

    console.log(metadata);
    console.log('--------------------');

    if (!contentType.startsWith('image/')) {
        console.log('This is not an image');
        return;
    }

    var options = {
        verbose: true
    };

    const file = storage.bucket(fileBucket).file(fileName);
    file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491'
    }).then(signedUrls => {
        console.log(`Signed ${signedUrls[0]}`); //contains the file's public URL
    }).catch(err => {
        console.log(`ERROR ${err}`);
    });

    return vision.detectLabels(storage.bucket(fileBucket).file(fileName), options).then((results) => {
        const userID = fileName.split('/', 1)[0];

        const labels = results[0];
        const descriptions = labels.filter((label) => label.score >= 0.7).map((label) => {
            return {
                description: label.desc,
                score: label.score
            }
        });

        const updates = {};
        updates[`photoPortfolio/${userID}`] = {
            userID: userID,
            contentType: contentType,
            descriptions: descriptions
        };

        return admin.database().ref().update(updates);

    }).catch((err) => {
        console.log(`Something went wrong: ${err}`);
    });

    // if (resourceState === 'not_exists') {
    //     /* Deleting or Moved the file */
    // }
});

function createAnnotateUrl() {
    return `https://vision.googleapis.com/v1/images:annotate?key=${functions.config().firebase.apiKey}`;
}

exports.pubsubTest = functions.pubsub.topic('projectMessages').onPublish(event => {
    const pubSubMessage = event.data;

    let name = null;

    try {
        name = pubSubMessage.json.name;
        console.log(`Hello, my name is ${name}`);
    } catch (e) {
        console.error('PubSub message was not JSON', e);
    }
});

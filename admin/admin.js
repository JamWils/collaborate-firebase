const fs = require('fs');
const util = require('util');

const json = JSON.stringify(createProjectPackages());

fs.writeFile('./db.json', json, (err) => {});

const client = require('firebase-tools');
client.database.set('/projectPackages', './db.json', {
    project: 'collaborate-6a96e',
    token: process.env.FIREBASE_TOKEN,
    cwd: './'
}).then(function() {
    console.log('New data pushed to database.');
}).catch(function(err) {
    console.log(err);
});


function createProjectPackages() {
    let parent = {}
    let projectPackages = createPackages();

    parent['jk2ena0U3GWzS'] = projectPackages;

    return parent;
}

function createPackages() {
    const packageOne = {
        title: "Just Supporting",
        description: "Your excited about the game \"Waking up!\", and want to give a small donation to support our project.  Every little bit counts.  Thank you!",
        minimumCost: "$1.00",
        totalPurchased: "0",
        totalReceived: 0
    };

    const packageTwo = {
        title: "1 Book",
        description: "You will receive one copy of \"Making Waking Up\"!",
        minimumCost: "$15.00",
        totalPurchased: "0",
        totalReceived: 0
    };

    const packageThree = {
        title: "1 Copy of \"Waking Up!\"",
        description: "You will receive one copy of the game \"Waking Up!\" for Windows, macOS, and Linux.",
        minimumCost: "$50",
        totalPurchased: "0",
        totalReceived: 0
    };

    const packageFour = {
        title: "Producer for \"Waking Up!\"",
        description: "Your name will appear in the opening credits as one of the producers of \"Waking Up\".  In addition, you will receive the items from all other packages.",
        minimumCost: "$10,000",
        limit: 3,
        totalPurchased: "0",
        totalReceived: 0
    };

    return {
        packageKey1: packageOne,
        packageKey2: packageTwo,
        packageKey3: packageThree,
        packageKey4: packageFour
    }
}
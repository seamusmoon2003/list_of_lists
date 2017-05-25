'use strict';
var Alexa = require("alexa-sdk");
var appId =  'amzn1.ask.skill.29a04ffb-44ec-45af-8ad1-4cc63af6d1bb';

// DynamoDB stuff
var AWS = require("aws-sdk");
var docClient = new AWS.DynamoDB.DocumentClient( {apiVersion: '2012-08-10'});

// ssml-builder stuff
var Speech = require('ssml-builder');
var speech = new Speech();
/* Example code for using ssml-builder:
Also, check out the AmazonSpeech part (see readme), that
can give Amazon specific speech like whisper.
require('ssml-builder/amazon_speech)
var Speech = require('ssml-builder');
 
var speech = new Speech();
speech.say('Hello');
speech.pause('1s');
speech.say('fellow Alexa developers');
speech.pause('500ms');
speech.say('Testing phone numbers');
speech.sayAs({
              word: "+1-377-777-1888",
              interpret: "telephone"
            });
var speechOutput = speech.ssml(true);
this.emit(':tell', speechOutput);
* end of example code */

// Table schema - ListItems
// A single table that looks like this:
// UserID (S: String), List Name (S: String), List Entries (L: List) 
// It would be great if the List Entries field could be a set. Need
// to figure out how to do that.
// Maybe use the createSet operation in the DocumentClient and
// DynamoDB will handle everything else on the back end.
// Each user has only one UserID, so that's unique.
// Each user can have a bunch of lists, but each list name has to be unique
// the list contains a list of entries. The List (L) type is an array.
// This means I have to change all of my code.


var NOT_IMPLEMENTED = ' is not yet implemented';

// dynamodb persistence
exports.handler = function (event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.registerHandlers(handlers);
    alexa.appId = appId;
    alexa.dynamoDBTableName = 'ListOfListsAttributes'; // That's it! 
    alexa.execute();
};

var handlers = {
    'LaunchRequest': function () {
        if (Object.keys(this.attributes).length === 0) { // Check if it's the first time the skill has been invoked 
            this.attributes['activeList'] = 'nothing';
            this.emit(':tell', 'You currently have no active list.');
        } else {
            this.emit(':saveState', true);
            this.emit(':tell', 'The current active list is ' + this.attributes['activeList']);
        }
    },
    'addItemIntent': function () {
        var self = this;
        var listItem = this.event.request.intent.slots.listText.value;
        var userId = this.event.session.user.userId;
        var myActiveList = this.attributes['activeList'];
        // Use the update method
        // listItems is a set, so we can use the ADD thing with the update
        // method. 
        var params =  {
            TableName: 'ListItems',
            Key: {
                'userId': userId,
                'listName': myActiveList
            },
            AttributeUpdates: {
                'listItems': {
                    Action: "ADD",
                    Value: docClient.createSet( listItem )
                }
            }
        };
        docClient.update( params, function(err, data) {
            if (err) console.log(err);
            else {
                console.log(data);
                self.emit(':tell', 'Added ' + listItem + ' to ' + myActiveList);
            }
        });
    },
    'changeActiveListIntent': function () {
        // changes the active list. Doesn't create a new
        // entry in the ListItems table though. That is only
        // done in the addItemIntent
        var newList = this.event.request.intent.slots.listName.value;
        this.attributes['activeList'] = newList;
        this.emit(':saveState', true);
        this.emit(':tell', 'Changing active list to ' + newList);
    },
    'deleteListIntent': function () {
        // This will delete all the items in the myItems table
        // for the activeList, then delete the list from the myLists table
        // and set the activeList to nothing
        var self = this;
        var userId = this.event.session.user.userId;
        var myList = this.attributes['activeList'];
        // delete the list items first
        var params = {
            TableName: "ListItems",
            KeyConditionExpression: "userId = :u",
            ExpressionAttributeValues: {
                ":u": userId
            }
        };
        docClient.query(params, function(err, data) {
            if (err) console.log(err, err.stack);
            else {
                var theItem;
                var theList;
                data.Items.forEach( function (item) {
                    var list_item = split(":", item.list_item);
                    theItem = list_item[1];
                    theList = list_item[0];
                    // now do the delete
                    if ( myList == theList ) {
                        params = {
                            TableName: "ListItems",
                            Key: {
                                "userId": userId,
                                "list_item": item.list_item
                            }
                        }
                        docClient.delete(params, function(err, data) {
                            if (err) consol
                        })
                    }
                    params = {
                        TableName: "ListItems"
                    }
                });
                    self.emit(':tell', 'Your saved lists are: ' + myResponse);
                }
        });
    },
    'newListIntent': function () {
        // User wants to create a new list.
        // Implementation is the same as changeActiveListIntent
        var newList = this.event.request.intent.slots.listName.value;
        this.attributes['activeList'] = newList;
        this.emit(':saveState', true);
        this.emit(':tell', 'Changing active list to ' + newList);
    },
    'removeItemIntent': function () {
        var self = this;
        var userId = this.event.session.user.userId;
        var myItem = this.event.request.intent.slots.listItem.value;
        var myList = this.attributes['activeList'];
        var list_item = myList + ':' + myItem;
        var params = {
            TableName: "ListItems",
            Key: {
                "userId": userId,
                "list_item": list_item
            },
            ConditionExpression:"list_item = :val",
            ExpressionAttributeValues: {
                ":val": list_item
            }
        }

        docClient.delete(params, function(err, data) {
            if (err) {
                console.log(err);
                self.emit(':tell', "Unable to delete " + myItem + " from " + myList);
            } else {
                self.emit(':tell', 'Item ' + myItem + ' deleted from ' + myList);
            }
        });
    },
    'sayAllListsIntent': function () {
        var self = this;          
        var userId = this.event.session.user.userId;
        var params = {
            TableName: "myLists",
            KeyConditionExpression: "userId = :u",
            ExpressionAttributeValues: {
                ":u": userId
            }
        };
        docClient.query(params, function(err, data) {
            if (err) console.log(err, err.stack);
            else {
                    var myResponse = "";
                    data.Items.forEach( function (item) {
                        myResponse = myResponse + ', ' + item.listName;
                    });
                    self.emit(':tell', 'Your saved lists are: ' + myResponse);
                }
        });
    },
    'sayListIntent': function () {
        var self = this;
        var userId = this.event.session.user.userId;
        var myList = this.attributes['activeList'];
        var params = {
            TableName: "ListItems",
            KeyConditionExpression: "userId = :u",
            ExpressionAttributeValues: {
                ":u": userId
            }
        };
        docClient.query(params, function(err, data) {
            if (err) console.log(err, err.stack);
            else {
                var myResponse = "";
                data.Items.forEach( function (item) {
                    var entry = item.list_item.split(":");
                    if (entry[0] == myList ) {
                        // get the item, and add it to the response
                        myResponse = myResponse + ', ' + entry[1];
                    }
                });
                self.emit(':tell', 'Active list is: ' + myList + ' The items in your active list are: ' + myResponse);
            }
        });
    }
};
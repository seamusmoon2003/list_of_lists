'use strict';
var Alexa = require("alexa-sdk");
var appId =  'amzn1.ask.skill.29a04ffb-44ec-45af-8ad1-4cc63af6d1bb';

// DynamoDB stuff
var AWS = require("aws-sdk");
var docClient = new AWS.DynamoDB.DocumentClient( {apiVersion: '2012-08-10'});

// ssml-builder stuff
var Speech = require('ssml-builder');
//var speech = new Speech();
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
// Maybe use the teSet operation in the DocumentClient and
// DynamoDB will handle everything else on the back end.
// Each user has only one UserID, so that's unique.
// Each user can have a bunch of lists, but each list name has to be unique
// the list contains a list of entries. The List (L) type is an array.
// This means I have to change all of my code.

// Globals
var NOT_IMPLEMENTED = ' is not yet implemented';
// Help Message
var helpMsgSpeech = new Speech();
helpMsgSpeech.say('The List of Lists skill allows you to maintain multiple lists with Alexa.');
helpMsgSpeech.pause('250ms');
helpMsgSpeech.say('To create a new list, say create list, and then the list name');
helpMsgSpeech.pause('250ms');
helpMsgSpeech.say('To add an entry to your active list, say: add entry followed by the entry name');
helpMsgSpeech.pause('250ms');
helpMsgSpeech.say('To switch to a different list say: change list to your list name');
helpMsgSpeech.pause('250ms');
helpMsgSpeech.say('To delete a list, say: delete list, and the name of the list to delete');
helpMsgSpeech.pause('250ms');
helpMsgSpeech.say('To remove an entry from a list, say: delete entry, followed by the entry name');
helpMsgSpeech.pause('250ms');
helpMsgSpeech.say('To say all of your lists, say: what are my lists');
helpMsgSpeech.pause('250ms');
helpMsgSpeech.say('To list the entries in your active list, say: what are my entries');
helpMsgSpeech.pause('250ms');
helpMsgSpeech.say('What would you like to do?')

// dynamodb persistence
exports.handler = function (event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.registerHandlers(handlers);
    alexa.appId = appId;
    alexa.dynamoDBTableName = 'ListOfListsAttributes'; // That's it! 
    alexa.execute();
};

var handlers = {
    // Built in Amazon intents:
    'AMAZON.HelpIntent': function () {
        var helpMsg = helpMsgSpeech.ssml(true);
        this.emit(':ask', helpMsg, 'Please say that again');
    },
    'LaunchRequest': function () {
        // Works
        if (Object.keys(this.attributes).length === 0) { // Check if it's the first time the skill has been invoked 
            this.attributes['activeList'] = 'nothing';
            this.emit(':tell', 'You currently have no active list.');
        } else {
            this.emit(':saveState', true);
            this.emit(':tell', 'The current active list is ' + this.attributes['activeList']);
        }
    },
    'openIntent': function () {
        // Works
        if (Object.keys(this.attributes).length === 0) { // Check if it's the first time the skill has been invoked 
            this.attributes['activeList'] = 'nothing';
            this.emit(':tell', 'You currently have no active list.');
        } else {
            this.emit(':saveState', true);
            this.emit(':tell', 'Welcome to your List of Lists. The current active list is ' + this.attributes['activeList']);
        }
    },
    'addItemIntent': function () {
        // Works
        var self = this;
        var listItem = this.event.request.intent.slots.listText.value;
        var userId = this.event.session.user.userId;
        var myActiveList = this.attributes['activeList'];
        // Use the update method
        // listItems is a set, so we can use the ADD thing with the update
        // method. 
        if (listItem) {
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
        } else {
            // Error condition where the listItem wasn't present.
            // Could be made better by a conversational interaction
                self.emit(':tell', 'I couldn\'t understand the item to add to the list. To add an item say: add entry, followed by the entry name.');
            }
    },
    'changeActiveListIntent': function () {
        // Works
        // changes the active list. Doesn't create a new
        // entry in the ListItems table though. That is only
        // done in the addItemIntent
        var newList = this.event.request.intent.slots.listName.value;
        if (newList) {
            this.attributes['activeList'] = newList;
            this.emit(':saveState', true);
            this.emit(':tell', 'Changing active list to ' + newList);
        } else {
            // Handling the empty list name.
            // Cna make it better by prompting for an answer.
            this.emit(':tell', 'I didn\'t get the list name. To change active lists say: change list to, followed by the list name');
        }
    },
    'deleteListIntent': function () {
        // Works, but I would like to change the actions somewhat
        // This will delete the list specified by the user
        var self = this;
        var activeList = this.attributes['activeList'];
        var userId = this.event.session.user.userId;
        var listToDelete = this.event.request.intent.slots.listName.value;
        if (listToDelete) {
          var params = {
                TableName: "ListItems",
                Key: {
                    "userId": userId,
                    "listName": listToDelete
                },
            }
            docClient.delete(params, function (err, data) {
                if (err) {
                    console.log(err);
                    self.emit(':tell', "Unable to delete " + listToDelete);
                } else {
                    // this is not exactly correct.
                    // I also would like to set the active list to nothing,
                    // and emit with state, but that wasn't working.
                    self.emit(':tell', 'Deleted list ' + listToDelete);
                }
            });
        } else {
            self.emit(':tell', 'I didn\'t get the list to delete. To delete a list say: delete list, and the name of the list to delete' );
        }
    },
    'newListIntent': function () {
        // Works
        // User wants to create a new list.
        // Implementation is the same as changeActiveListIntent
        var newList = this.event.request.intent.slots.listName.value;
        if (newList) {
            this.attributes['activeList'] = newList;
            this.emit(':saveState', true);
            this.emit(':tell', 'Changing active list to ' + newList);
        } else {
            // Handling the empty list name.
            // Cna make it better by prompting for an answer.
            this.emit(':tell', 'I didn\'t get the name of the list. To create a new list, say create list, and then the list name');
        }
    },
    'removeItemIntent': function () {
        // Works.
        var self = this;
        var userId = this.event.session.user.userId;
        var listItem = this.event.request.intent.slots.listItem.value;
        if (listItem) {
            var myList = this.attributes['activeList'];
            var params =  {
                TableName: 'ListItems',
                Key: {
                    'userId': userId,
                    'listName': myList
                },
                AttributeUpdates: {
                    'listItems': {
                        Action: "DELETE",
                        Value: docClient.createSet(listItem)
                    }
                }
            };
            docClient.update( params, function(err, data) {
                if (err) {
                    console.log(err);
                    self.emit(':tell', 'There was an error deleting ' + listItem + ' from ' + myList);
                }
                else {
                    console.log(data);
                    self.emit(':tell', 'Deleted ' + listItem + ' from ' + myList);
                }
            });
        } else {
            self.emit(':tell', 'I didn\'t get the item to delete. To remove an entry from a list, say: delete entry, followed by the entry name.');
        }
    },
    'sayAllListsIntent': function () {
        // Works
        // Need a slight adjustment on the response for the commas in the list.
        // Would also like to add some speech enhancements like pauses.
        var self = this;          
        var userId = this.event.session.user.userId;
        var myActiveList = this.attributes['activeList'];
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
                        myResponse = item.listName + ', ' + myResponse;
                    });
                    self.emit(':tell', 'Your saved lists are: ' + myResponse + ' Current active list is ' + myActiveList);
                }
        });
    },
    'sayListIntent': function () {
        // Works
        // Still a slight mod needs to be made to fix the comma at the end of the list
        // and then maybe add some pauses in.
        var self = this;
        var userId = this.event.session.user.userId;
        var myList = this.attributes['activeList'];
        var params = {
            TableName: "ListItems",
            KeyConditionExpression: "userId = :u and listName = :val",
            ExpressionAttributeValues: {
                ":u": userId,
                ":val": myList
            }
        };
        docClient.query(params, function(err, data) {
            if (err) {
                console.log(err, err.stack);
                self.emit(':tell', 'Error in the list query');
            }
            else {
                // There will always be only 1 thing returned
                var myResponse = "";
                console.log(data);
                data.Items.forEach( function (item) {
                    console.log(item);
                    item.listItems.values.forEach( function (entry) {
                        console.log(entry);
                        myResponse = entry + ', ' + myResponse;
                    });
                });
                if (myResponse.length === 0) {
                    self.emit(':tell', 'The list ' + myList + ' is empty');
                } else {
                    self.emit(':tell', 'Items in list ' + myList + ' are: ' + myResponse);
                }
            }
        });
    }
};
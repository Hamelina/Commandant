'use strict';
const Alexa = require('alexa-sdk');
const AWS = require('aws-sdk'),
	uuid = require('uuid'),
  documentClient = new AWS.DynamoDB.DocumentClient(); 
  
  // Set the region 
AWS.config.update({region: 'eu-west-1'});

const APP_ID = process.env.APP_ID;

const SKILL_NAME = 'Cookyt';
const HELLO_MESSAGE = "Hello World !";
const HELP_MESSAGE = 'You can say tell me a space fact, or, you can say exit... What can I help you with?';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';
const UNHANDLED_MESSAGE = "Sorry i didn't understand that";

const handlers = {
  'LaunchRequest': function () {
    this.emit('HelloWorld');
  },
  'HelloWorld': function () {
    this.emit(':tell',"Hello World");
  },
  'AddUser': function () {
    var params = {
      Item : {
        "Id" : uuid.v1(),
        "FirstName" : this.event.firstName,
        "LastName" : this.event.lastName
      },
      TableName : 'users'
    };
    documentClient.put(params, function(err, data){
      if (err)
        console.log("Error", err, data);
    });

    this.emit(':tell','Profil ajouté avec succès !')
  },
  'findUser': function () {
    var params = {
      ExpressionAttributeValues: {
        ':name' : {S: this.event.name}
      },
      FilterExpression: 'contains (FirstName, :name)',
      TableName : 'users'
    };
    documentClient.scan(params, function(err, data){
      if (err){
        console.log("Error", err, data);
      }
      else {
        console.log(data);
        this.emit(':tell',data)    
      }
    });
  },
  // Medecine CRUD
  'AddMedicine': function () {
    var params = {
      Item : {
        "Id" : uuid.v1(),
        "MedecineName" : this.event.name,
        "Quantity": 0
      },
      TableName : 'medicines'
    };
    documentClient.put(params, function(err, data){
      if (err)
        console.log("Error", err, data);
    });

    this.emit(':tell','Medicament enregistré avec succès !')
  },
  'findMedicineByName': function () {
    var params = {
      ExpressionAttributeValues: {
        ':name' : {S: this.event.name}
      },
      FilterExpression: 'contains (MedicineName, :name)',
      TableName : 'medecines'
    };
    documentClient.scan(params, function(err, data){
      if (err){
        console.log("Error", err, data);
      }
      else {
        console.log("Success", data);
        //this.emit(':tell',data)    
      }
    });
    //this.emit(':tell','Medicament ajoutée avec succès !')
  },
  'deleteMedicineByName': function () {
    var params = {
      TableName: 'medecines',
      ExpressionAttributeValues: {
        ':name' : {S: this.event.name}
      }
    };
    documentClient.deleteItem(params, function(err, data){
      if (err){
        console.log("Error", err, data);
      }
      else {
        console.log("Success", data);
        //this.emit(':tell',data)    
      }
    });
    //this.emit(':tell','Medicament ajoutée avec succès !')
  },
  'AMAZON.HelpIntent': function () {
    const speechOutput = HELP_MESSAGE;
    const reprompt = HELP_REPROMPT;

    this.response.speak(speechOutput).listen(reprompt);
    this.emit(':responseReady');
  },
  'AMAZON.CancelIntent': function () {
      this.response.speak(STOP_MESSAGE);
      this.emit(':responseReady');
  },
  'AMAZON.StopIntent': function () {
      this.response.speak(STOP_MESSAGE);
      this.emit(':responseReady');
  },
  'Unhandled': function () {
    this.response.speak(UNHANDLED_MESSAGE);
    this.emit(':responseReady');
  },
}

exports.handler = function (event, context, callback) {
  const alexa = Alexa.handler(event, context, callback);
  alexa.APP_ID = APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};

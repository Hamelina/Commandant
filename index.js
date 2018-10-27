'use strict';
var SSH = require('simple-ssh');
const fs = require('fs')
const path = require('path')
const Alexa = require('alexa-sdk');
const AWS = require('aws-sdk'),
	uuid = require('uuid'),
  documentClient = new AWS.DynamoDB.DocumentClient(); 
  
  // Set the region 
AWS.config.update({region: 'eu-west-1'});
const key_rsa = fs.readFileSync(path.resolve(__dirname, './id_rsa'), 'utf8')
const APP_ID = process.env.APP_ID;

const SKILL_NAME = 'Commandant';
const HELLO_MESSAGE = "Hello World !";
const HELP_MESSAGE = 'You can say tell me a space fact, or, you can say exit... What can I help you with?';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';
const UNHANDLED_MESSAGE = "Sorry i didn't understand that";
const ssh = new SSH({
  host: '0.tcp.ngrok.io',
  port: 14742,
  user: 'h',
  key : key_rsa
});
ssh.on('error', function(err) {
  console.log('Oops, something went wrong.');
  console.log(err);
  ssh.end();
});
const handlers = {
  'LaunchRequest': function () {
    this.emit('CmdPWD');
  },
  'CmdPWD': function () {
    let _self = this;
    var promise1 = new Promise( function(resolve, reject) {
      ssh.exec('pwd', {
        out : function(stdout){
            resolve(stdout.toString());
        }   
      }).start()
    });
    promise1.then(function(value) {
      console.log(value);
       _self.emit(':tell',value);
      })
      .catch(function(e) {
        console.log(e); // "zut !"
      })
      .then(function(e){
       _self.emit(':tell',"Commande non reconnu");
  });
  },
  'choiceAction': function () {
    if(this.event.request.intent.slots.choiceActionHealth.value ==="consulter"){
      this.emit(':ask',"Donnez moi le nom du médicament à consulter ?")
    }else if(this.event.request.intent.slots.choiceActionHealth.value ==="ajouter"){
      this.emit(':ask',"Qu'elle est le nom du médicament à ajouter ?")
    }
},

  'choiceAddMedicine': function () {
    this.attributes.nameMedecine = this.event.request.intent.slots.nameMedecine.value
    this.emit(':ask',"Quel est la dose de "+ this.event.request.intent.slots.nameMedecine.value + " ?")
},
'choiceDose': function () {
  this.attributes.doseMedecine = this.event.request.intent.slots.doseValue.value
  this.attributes.typeDoseMedecine = this.event.request.intent.slots.typeDose.value
  this.emit(':ask',"Quelle est la durée du traitement ?")
},
'durationMedecine': function () {
  this.attributes.numberDurationMedecine = this.event.request.intent.slots.durationNumber.value
  this.attributes.typeDurationMedecine = this.event.request.intent.slots.durationType.value
  this.emit(':ask',"Nous allons lister les heures de prises quotidiennes, donnez moi la première heure de prise de la journée")
},
'giveHours': function () {
  if(this.attributes.hoursMedicine){
    this.attributes.hoursMedicine.push(this.event.request.intent.slots.hour.value)
  }else{
    this.attributes.hoursMedicine = [this.event.request.intent.slots.hour.value]
  }
  this.emit(':ask',"L'heure a été ajouté, avez-vous d'autres heures, répondez oui ou non")
},
'reapeatHour': function () {
  if(this.event.request.intent.slots.responseRepeat.value === "oui"){
    this.emit(':ask',"Donner une nouvelle heure")
  }else if(this.event.request.intent.slots.responseRepeat.value === "non"){
    /*this.emit(':ask',"L'ajout du médicament est terminé. Voici un récapitulatif, nom du médicament : " + this.attributes.nameMedecine + 
    " dose : " + this.attributes.doseMedecine + this.attributes.typeDoseMedecine+
    " durée : pendant" + this.attributes.numberDurationMedecine + this.attributes.typeDurationMedecine+
    " pour les heures : "+ this.attributes.hoursMedicine.join(","))*/
    this.emit(':ask',"La saisie est terminée")
  }
  
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
  /*'AddMedicine': function () {
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
  },*/
    'responseAddMedicine': function () {
      this.emit(':ask',"Quel est le nom du médicament ?")
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

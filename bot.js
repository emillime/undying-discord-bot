const fs = require("fs");
const Discord = require("discord.js");
var moment = require("moment");
var _ = require("lodash");
const client = new Discord.Client();

var config = require("./config.json");
var war = require("./war.json");

const towers = [
  "tt1",
  "tt2",
  "tt3",
  "bt1",
  "bt2",
  "bt3",
  "mt1",
  "tm",
  "mm",
  "bm",
  "keep"
];

const commands = {
  prefix: message => {
    if (!isLeader(message)) return;

    // Gets the prefix from the command (eg. "!prefix +" it will take the "+" from it)
    let newPrefix = message.content.split(" ").slice(1, 2)[0];
    // change the configuration in memory
    config.prefix = newPrefix;

    // Now we have to save the file.
    fs.writeFile("./config.json", JSON.stringify(config), err => console.error);
  },

  start: (message, args) => {
    if (!isLeader(message)) return;

    war.start = moment()
      .startOf("day")
      .add(16, "hours");
    towers.forEach(t => (war.requests[t] = {}));

    message.channel.send(
      "New war " +
        moment(war.start).fromNow() +
        "\nType `!help` for all commands. Good luck!"
    );

    fs.writeFile("./war.json", JSON.stringify(war), err => console.error);
  },

  next: (message, args) => {
    var d = nextPoint();
    message.channel.send("Next point in: " + d.humanizePrecisely());
  },

  current: (message, args) => {
    var p = pointsSinceStart();
    message.channel.send("Current points: " + p);
  },

  points: (message, args) => {
    if (args[0] === undefined || args[0] > 200 || args[0] < 1) {
      message.channel.send("Please enter a value between 1 and 200");
    } else {
      var t = timeToGetXPoints(args[0]);
      message.channel.send(
        "You will get " + args[0] + " points in: " + t.humanizePrecisely()
      );
    }
  },

  request: (message, args) => {
    var line = Number(args[0]);
    var tower = args[1];

    if (
      line < 1 ||
      line > 15 ||
      Number.isNaN(line) ||
      !towers.includes(tower)
    ) {
      message.channel.send(
        "`!request <line number> <tower>` Please enter a number between 1 and 15 and a tower from the list. (tt1, tt2, tt3, bt1, bt2, bt3, mt1, tm, mm, bm, keep)"
      );
      return;
    }

    clearOldRequests();

    if (line in war.requests[tower]) {
      message.channel.send(
        "Line " +
          line +
          " in " + tower + " is already requested by " +
          war.requests[tower][line].nick +
          ". It was requested " + moment.duration(moment().diff(war.requests[tower][line].timeOfRequest)).humanizePrecisely() + " ago."
      );
    } else {
      var nick = getNick(message);
      var id = message.author.id;
      var timeOfRequest = moment();

      war.requests[tower][line] = {nick, id, timeOfRequest};
      message.channel.send(
        "You are now signed up for line " + line + " in " + tower + ". Attack it within 1h, after that someone else can take it."
      );
    }

    fs.writeFile("./war.json", JSON.stringify(war), err => console.error);
  },

  clear: (message, args) => {
    var line = Number(args[0]);
    var tower = args[1];
    if (
      line < 1 ||
      line > 15 ||
      Number.isNaN(line) ||
      !towers.includes(tower)
    ) {
      message.channel.send(
        "`!clear <line number> <tower>` Please enter a number between 1 and 15 and a tower from the list. (tt1, tt2, tt3, bt1, bt2, bt3, mt1, tm, mm, bm, keep)"
      );
      return;
    }

    // Note: Checking nickname can be bypassed if people change the nickname.
    if (war.requests[tower][line].nick === getNick(message) || isLeader(message)) {
      delete war.requests[tower][line];
      message.channel.send(
        "Line " + line + " in " + tower + " is now up for grabs!"
      );
    } else {
      message.channel.send("You can only remove your name from the list.");
    }

    fs.writeFile("./war.json", JSON.stringify(war), err => console.error);
  },

  list: (message, args) => {
    var tower = args[0];

    clearOldRequests();

    if (towers.includes(tower)) {
      var response = "These are the lines requested for " + tower + ":\n";
      for (var line in war.requests[tower]) {
        response += "Line " + line + ": " + war.requests[tower][line].nick + "\n";
      }
      message.channel.send(response);
    } else {
      var response = "These are the lines requested for all towers:\n";
      towers.forEach(function(t) {
        if (!_.isEmpty(war.requests[t])) {
          response += "**" + t + ":**\n";
          for (var line in war.requests[t]) {
            response += "Line " + line + ": " + war.requests[t][line].nick + "\n";
          }
        }
      });
      message.channel.send(response);
    }
  },

  help: (message, args) => {
    message.channel.send(
      "These are the commands I can do:\n\
        `!help` Shows a list with all the commands.\n\
        `!next point` The time until the next war point.\n\
        `!current` The current points if you haven't donated or attacked yet.\n\
        `!points <number>` Tells you how long it will take to generate `<number>` points.\n\
        `!request <number> <tower>` Signs you up for the line in that tower.\n\
        `!clear <number> <tower>` Removes you from that line in the list.\n\
        `!list <tower>` Shows the list for a specific tower, if you don't add a tower all towers will be shown.\n\
        These are the tower names: (tt1, tt2, tt3, bt1, bt2, bt3, mt1, tm, mm, bm, keep)\n\
        "
    );
  }
};

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", message => {
  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content
    .slice(config.prefix.length)
    .trim()
    .split(/ +/g);
  const command = args.shift().toLowerCase();

  if (commands[command]) {
    commands[command](message, args);
  }
});

function clearOldRequests() {
  var now = moment();
  _.each(war.requests, function(lines, tower) {
    _.each(lines, function(req, line) {
      // If the request is older than 1h, remove it.
      console.log(now);
      console.log(req['timeOfRequest']);
      console.log(moment.duration(now.diff(req['timeOfRequest'])).asHours());
      if (moment.duration(now.diff(req['timeOfRequest'])).asHours() > 1) {
        console.log("Clearing line: " + line + " in tower " + tower);
        delete war.requests[tower][line];
      }
    })
  })
  fs.writeFile("./war.json", JSON.stringify(war), err => console.error);
}

function getNick(message) {
  var nick = message.guild.members.get(message.author.id).nickname;
  return nick == null ? message.author.username : nick;
}

function isLeader(message) {
  return message.member.roles.some(r => ["435844284025929738", "435837050269335552", "435836769171275786"].includes(r.id))
  || message.author.id == config.ownerID;
}

function durationSinceStart() {
  var now = moment();
  var warStart = moment(war.start);
  var timeSinceStart = moment.duration(now.diff(warStart));
  return timeSinceStart;
}

function pointsSinceStart() {
  var points = war.startingpoints;
  var duration = durationSinceStart();

  var d = moment.duration(0, "hours");
  d.add(war.regen, "hours");

  while (d < duration) {
    points++;

    if (d.asHours() < 24) {
      d.add(war.regen, "hours");
    } else if (d.asHours() < 48) {
      d.add(war.regen / 3, "hours");
    } else {
      d.add(war.regen / 5, "hours");
    }
  }

  return points;
}

function nextPoint() {
  var duration = durationSinceStart();

  var d = moment.duration(0, "hours");
  d.add(war.regen, "hours");

  while (d < duration) {
    if (d.asHours() < 24) {
      d.add(war.regen, "hours");
    } else if (d.asHours() < 48) {
      d.add(war.regen / 3, "hours");
    } else {
      d.add(war.regen / 5, "hours");
    }
  }

  return moment.duration(d - duration);
}

function timeToGetXPoints(points) {
  var totalDuration = durationSinceStart().add(nextPoint());
  var d = moment.duration(nextPoint());
  points--;

  while (points > 0) {
    points--;

    if (totalDuration.asHours() < 24) {
      totalDuration.add(war.regen, "hours");
      d.add(war.regen, "hours");
    } else if (totalDuration.asHours() < 48) {
      totalDuration.add(war.regen / 3, "hours");
      d.add(war.regen / 3, "hours");
    } else {
      totalDuration.add(war.regen / 5, "hours");
      d.add(war.regen / 5, "hours");
    }
  }

  return d;
}

// All the below is to use more precise 'humanize'. See https://github.com/moment/moment/issues/348

moment.relativeTimeThreshold("s", 60);
moment.relativeTimeThreshold("ss", 0); // must be after 's', disables "few seconds"
moment.relativeTimeThreshold("m", 60);
moment.relativeTimeThreshold("h", 24);
moment.relativeTimeThreshold("d", 31);
moment.relativeTimeThreshold("M", 12);

/**
 * Return a precize human readable string representing the given moment duration.
 *
 * @param {Moment.Duration} duration
 * @param {{mostPreciseUnit: string, numberOfSignificantParts: integer}} options
 */
moment.duration.fn.humanizePrecisely = function(options = {}) {
  // Split the duration into parts to be able to filter out unwanted ones
  const allParts = [
    { value: this.years(), unit: "years" },
    { value: this.months(), unit: "months" },
    { value: this.days(), unit: "days" },
    { value: this.hours(), unit: "hours" },
    { value: this.minutes(), unit: "minutes" },
    { value: this.seconds(), unit: "seconds" }
    // cannot format with moment.humanize()
    //{ value: duration.milliseconds(), unit: 'milliseconds' },
  ];

  return (
    _(allParts)
      // only use the first parts until the most precise unit wanted
      .take(
        _.findIndex(allParts, { unit: options.mostPreciseUnit || "seconds" }) +
          1
      )
      // drop the most significant parts with a value of 0
      .dropWhile(part => part.value === 0)
      // skip other zeroes in the middle (moment.humanize() can't format them)
      .reject(part => part.value === 0)
      // use only the significant parts requested
      .take(options.numberOfSignificantParts || allParts.length)
      // format each part
      .map(part =>
        moment
          .duration(part.value, part.unit)
          .locale(this.locale())
          .humanize()
      )
      .join(" ")
  );
};

client.login(config.token);

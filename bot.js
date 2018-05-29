const fs = require("fs");
const Discord = require("discord.js");
var moment = require("moment");
var _ = require("lodash");
const client = new Discord.Client();

var config = require("./config.json");
var war = require("./war.json");

const commands = {
  prefix: message => {
    if (message.author.id !== config.ownerID) return;

    // Gets the prefix from the command (eg. "!prefix +" it will take the "+" from it)
    let newPrefix = message.content.split(" ").slice(1, 2)[0];
    // change the configuration in memory
    config.prefix = newPrefix;

    // Now we have to save the file.
    fs.writeFile("./config.json", JSON.stringify(config), err => console.error);
  },

  start: (message, args) => {
    if (message.author.id !== config.ownerID) return;

    war.start = moment()
      .startOf("day")
      .add(16, "hours");
    war.keep.requests = {};

    message.channel.send(
      "New war started " +
        moment(war.start).fromNow() +
        "\nSign up for a keep line by using !request <line number>. Good luck!"
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
    if (typeof args[0] == "undefined" || args[0] > 200 || args[0] < 1) {
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
    if (line < 1 || line > 12 || Number.isNaN(line)) {
      message.channel.send("Please enter a number between 1 and 12.");
      return;
    }

    if (line in war.keep.requests) {
      message.channel.send(
        "Line " +
          line +
          " in the keep is already requested by " +
          war.keep.requests[line] +
          "."
      );
    } else {
      var nick = message.guild.members.get(message.author.id).nickname;
      nick = nick == null ? message.author.username : nick;

      war.keep.requests[line] = nick;
      message.channel.send(
        "You are now signed up for line " + line + " in the keep."
      );
    }

    fs.writeFile("./war.json", JSON.stringify(war), err => console.error);
  },

  list: (message, args) => {
    var response = "These are the lines requested for the keep:\n";
    for (var line in war.keep.requests) {
      response += "Line " + line + ": " + war.keep.requests[line] + "\n";
    }
    message.channel.send(response);
  },

  help: (message, args) => {
    message.channel.send(
      "These are the commands I can do:\n\
        `!help` Shows a list with all the commands.\n\
        `!next point` The time until the next war point.\n\
        `!current` The current points if you haven't donated or attacked yet.\n\
        `!points <number>` Tells you how long it will take to generate `<number>` points.\n\
        `!request <number>` Signs you up for that keep line.\n\
        `!list` Shows the keep list.\n\
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

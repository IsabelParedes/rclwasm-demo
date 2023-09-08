class MessageStack {
    constructor(size) {
        this.element = [];
        this.size = size
        this.top = -1
    }

    isEmpty() {
        return (this.element.length == 0)
    }

    push(element) {
        this.top++;
        // Wrap around
        this.top = (this.top < this.size) ? this.top : 0;
        this.element[this.top] = element;
    }

    pop() {
        // LIFO : get most recent
        if (this.isEmpty()) return null;
        const value = this.element[this.top]
        this.element[this.top] = null;
        return value
    }

    clear() {
        this.element = new Array()
        this.top = -1
    }
}


const topicMap = {};
let talker = null;
let listener = null;
let server = null;
let client = null;
let vernieLED = null;
let rclPublisher = new Worker("./ws-build/rclwasm/rcl_publisher.js");
let rclSubscriber = new Worker("./ws-build/rclwasm/rcl_subscriber.js");

const publisherRoles = ["publisher", "service_server", "action_server"];
const subscriberRoles = ["subscriber", "service_client", "action_client"];


// Receive messages from workers
let onMessageFromWorker = function( event ) {
    switch( event.data.command )
    {
        case "register":
            if (!(event.data.topic in topicMap)) {
                topicMap[event.data.topic] = {
                    messages: new MessageStack(10),
                    publishers: [],
                    subscribers: [],
                }
            }

            if (publisherRoles.includes(event.data.role)) {
                topicMap[event.data.topic].publishers.push(event.data.gid);
            }
            else if (subscriberRoles.includes(event.data.role)) {
                topicMap[event.data.topic].subscribers.push(event.data.gid);
            }
            else {
                console.log("INVALID ROLE ", event.data.role);
            }

            break;

        case "deregister":

            let gidIndex = "";
            if (publisherRoles.includes(event.data.role)) {
                gidIndex = topicMap[event.data.topic].publishers.indexOf(event.data.gid);
                // console.log("DEREG PUB:", gidIndex, event.data.role, event.data.topic);
                if (gidIndex > -1) {
                    topicMap[event.data.topic].publishers.splice(gidIndex, 1);
                };

            }
            else if (subscriberRoles.includes(event.data.role)) {
                gidIndex = topicMap[event.data.topic].subscribers.indexOf(event.data.gid);
                // console.log("DEREG SUB:", gidIndex, event.data.role, event.data.topic);
                if (gidIndex > -1) {
                    topicMap[event.data.topic].subscribers.splice(gidIndex, 1);
                };
            }
            else {
                console.log("INVALID GID ", event.data.gid);
            }

            break;

        case "publish":
            // Remove new lines to prevent truncation
            let pubMsg = event.data.message.replaceAll(/\n/g, ", ");
            topicMap[event.data.topic].messages.push(pubMsg);
            break;

        case "retrieve":
            let msgPopped = topicMap[event.data.topic].messages.pop();

            if (msgPopped !== null) {
                // Broadcast to all subscribers
                if (listener !== null) {
                    listener.postMessage({
                        command: "broadcast",
                        topic: event.data.topic,
                        message: msgPopped
                    });
                };
                if (talker !== null) {
                    talker.postMessage({
                        command: "broadcast",
                        topic: event.data.topic,
                        message: msgPopped
                    });
                };
                if (client !== null) {
                    client.postMessage({
                        command: "broadcast",
                        topic: event.data.topic,
                        message: msgPopped
                    });
                };
                if (server !== null) {
                    server.postMessage({
                        command: "broadcast",
                        topic: event.data.topic,
                        message: msgPopped
                    });
                };
                if (rclSubscriber !== null) {
                    rclSubscriber.postMessage({
                        command: "broadcast",
                        topic: event.data.topic,
                        message: msgPopped
                    });
                };
            }

            break;

        case "console":
            let rawMessage = event.data.message;
            // Remove end chars
            let msg = rawMessage.substr(4, rawMessage.length - 8);
            let boxOutput = document.getElementById(event.data.role + "Output");
            boxOutput.scrollTop = boxOutput.scrollHeight;
            boxOutput.innerHTML += msg + "\n";
            break;
    }
}

////////////////////////////////////////////////////////////////////////////////
// RCL Publisher ///////////////////////////////////////////////////////////////

function startRCLPub() {

    document.getElementById("rclpubOutput").innerHTML += "Publisher initializing.\n";

    rclPublisher.onmessage = onMessageFromWorker;

    let params = document.getElementById("publisherForm");

    rclPublisher.postMessage({
        command:  "initNode",
        node:     params.elements[0].value,
        topic:    params.elements[1].value,
        message:  params.elements[2].value,
        mseconds: isNaN(Number(params.elements[3].value)) 
                  ? 1
                  : Number(params.elements[3].value),
    });
}

function stopRCLPub() {
    if (rclPublisher !== null) {
        rclPublisher.terminate();
        rclPublisher = null;
    }
    document.getElementById("rclpubOutput").innerHTML += "Publisher terminated.\n\n";

    rclPublisher = new Worker("./ws-build/rclwasm/rcl_publisher.js");
}

function clearRCLPub() {
    document.getElementById("rclpubOutput").innerHTML = "";
}

////////////////////////////////////////////////////////////////////////////////
// RCL Subscriber ///////////////////////////////////////////////////////////////

function startRCLSub() {

    document.getElementById("rclsubOutput").innerHTML += "Subscriber initializing.\n";

    rclSubscriber.onmessage = onMessageFromWorker;

    let params = document.getElementById("subscriberForm");

    rclSubscriber.postMessage({
        command:  "initNode",
        node:     params.elements[0].value,
        topic:    params.elements[1].value,
        message:  false,
        mseconds: 0,
    });
}

function stopRCLSub() {
    if (rclSubscriber !== null) {
        rclSubscriber.terminate();
        rclSubscriber = null;
    }
    document.getElementById("rclsubOutput").innerHTML += "Subscriber terminated.\n\n";

    rclSubscriber = new Worker("./ws-build/rclwasm/rcl_subscriber.js");
}

function clearRCLSub() {
    document.getElementById("rclsubOutput").innerHTML = "";
}

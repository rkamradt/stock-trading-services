const kafka = require('./kafka');

const producer = kafka.producer({
  allowAutoTopicCreation: true,
  transactionTimeout: 30000,
});

/**
 * Connect the Kafka producer.
 * Should be called once during application startup.
 */
async function connect() {
  await producer.connect();
  console.log('[producer] Connected to Kafka');
}

/**
 * Publish a message to a Kafka topic.
 *
 * Topics this producer publishes to:
 *   - notification.sent    : Emitted when a message is successfully delivered to customer
 *   - alert.triggered      : Emitted when customer-defined alert conditions are met
 *   - notification.failed  : Emitted when message delivery fails
 *   - preference.updated   : Emitted when customer changes notification settings
 *
 * @param {string} topic   - Kafka topic name
 * @param {object} payload - Event payload (will be JSON-serialised)
 */
async function publish(topic, payload) {
  const message = {
    key: payload.customerId || payload.notificationId || payload.alertId || null,
    value: JSON.stringify(payload),
    headers: {
      'content-type': 'application/json',
      'source-service': 'notification-service',
      'event-time': new Date().toISOString(),
    },
  };

  await producer.send({ topic, messages: [message] });
  console.log(`[producer] Published to topic "${topic}":`, JSON.stringify(payload));
}

/**
 * Gracefully disconnect the producer.
 */
async function disconnect() {
  await producer.disconnect();
  console.log('[producer] Disconnected from Kafka');
}

module.exports = { connect, publish, disconnect };

const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'market-data-provider',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const producer = kafka.producer();

/**
 * Connect the Kafka producer to the broker cluster.
 * Must be called once during application startup before any publish() calls.
 *
 * @returns {Promise<void>}
 */
async function connect() {
  await producer.connect();
  console.log('[producer] Connected to Kafka brokers:', process.env.KAFKA_BROKERS || 'localhost:9092');
}

/**
 * Disconnect the Kafka producer gracefully.
 * Should be called during application shutdown.
 *
 * @returns {Promise<void>}
 */
async function disconnect() {
  await producer.disconnect();
  console.log('[producer] Disconnected from Kafka');
}

/**
 * Publish an event payload to a Kafka topic.
 *
 * Topics published:
 *   "market.quote_updated"    — Emitted when real-time price data changes
 *   "market.corporate_action" — Emitted for dividends, splits, and other corporate events
 *
 * @param {string} topic - Kafka topic name
 * @param {object} payload - Event payload object; will be JSON-serialised as the message value
 * @returns {Promise<void>}
 */
async function publish(topic, payload) {
  await producer.send({
    topic,
    messages: [
      {
        key: payload.symbol || null,
        value: JSON.stringify(payload),
        headers: {
          eventType: payload.eventType || topic,
          eventId: payload.eventId || '',
          occurredAt: payload.occurredAt || new Date().toISOString(),
        },
      },
    ],
  });
}

module.exports = {
  connect,
  disconnect,
  publish,
};

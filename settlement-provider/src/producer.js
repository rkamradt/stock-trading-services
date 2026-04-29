const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'settlement-provider',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const producer = kafka.producer();

/**
 * Connect the Kafka producer. Must be called before any publish() calls.
 * @returns {Promise<void>}
 */
async function connect() {
  await producer.connect();
  console.log('[producer] Connected to Kafka brokers:', process.env.KAFKA_BROKERS || 'localhost:9092');
}

/**
 * Disconnect the Kafka producer gracefully.
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
 *   "settlement.submitted"  — Emitted when settlement instructions are sent to external network
 *   "settlement.confirmed"  — Emitted when external system confirms successful settlement
 *   "settlement.failed"     — Emitted when settlement fails in external system
 *   "settlement.exception"  — Emitted when manual intervention is required for settlement
 *
 * @param {string} topic   - Kafka topic name
 * @param {object} payload - Event payload object (will be JSON-stringified)
 * @returns {Promise<void>}
 */
async function publish(topic, payload) {
  const messageValue = JSON.stringify(payload);
  await producer.send({
    topic,
    messages: [
      {
        key: payload.settlementId ? String(payload.settlementId) : payload.tradeId ? String(payload.tradeId) : undefined,
        value: messageValue,
        headers: {
          eventId: payload.eventId || '',
          occurredAt: payload.occurredAt || new Date().toISOString(),
          source: 'settlement-provider',
        },
      },
    ],
  });
  console.log(`[producer] Published to ${topic}:`, payload.eventId || '(no eventId)');
}

module.exports = {
  connect,
  disconnect,
  publish,
};

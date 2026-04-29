const kafka = require('./kafka');
const producer = require('./producer');

const handleOrderFilled = require('./handlers/order-filled');
const handleMarginCallTriggered = require('./handlers/margin-call_triggered');
const handleRiskLimitBreached = require('./handlers/risk-limit_breached');

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_CONSUMER_GROUP || 'notification-service-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

/**
 * Topic-to-handler routing map.
 */
const TOPIC_HANDLERS = {
  'order.filled': handleOrderFilled,
  'margin.call_triggered': handleMarginCallTriggered,
  'risk.limit_breached': handleRiskLimitBreached,
};

/**
 * Start the Kafka consumer:
 *  1. Connect to the broker
 *  2. Subscribe to all required topics
 *  3. Route each message to the appropriate handler
 *  4. Publish any outbound events returned by the handler
 */
async function startConsumer() {
  await consumer.connect();
  console.log('[consumer] Connected to Kafka');

  for (const topic of Object.keys(TOPIC_HANDLERS)) {
    await consumer.subscribe({ topic, fromBeginning: false });
    console.log(`[consumer] Subscribed to topic "${topic}"`);
  }

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const rawValue = message.value ? message.value.toString() : null;

      if (!rawValue) {
        console.warn(`[consumer] Received empty message on topic "${topic}", partition ${partition} — skipping`);
        return;
      }

      let payload;
      try {
        payload = JSON.parse(rawValue);
      } catch (parseError) {
        console.error(`[consumer] Failed to parse JSON on topic "${topic}":`, parseError.message, '— raw:', rawValue);
        return;
      }

      console.log(`[consumer] Received message on topic "${topic}":`, JSON.stringify(payload));

      const handler = TOPIC_HANDLERS[topic];
      if (!handler) {
        console.warn(`[consumer] No handler registered for topic "${topic}" — skipping`);
        return;
      }

      let result;
      try {
        result = await handler(payload);
      } catch (handlerError) {
        console.error(`[consumer] Handler error for topic "${topic}":`, handlerError);
        return;
      }

      if (result) {
        const outboundEvents = Array.isArray(result) ? result : [result];
        for (const event of outboundEvents) {
          if (event && event.topic && event.payload) {
            try {
              await producer.publish(event.topic, event.payload);
            } catch (publishError) {
              console.error(`[consumer] Failed to publish outbound event to "${event.topic}":`, publishError);
            }
          }
        }
      }
    },
  });
}

/**
 * Gracefully disconnect the consumer.
 */
async function disconnect() {
  await consumer.disconnect();
  console.log('[consumer] Disconnected from Kafka');
}

module.exports = { startConsumer, disconnect };

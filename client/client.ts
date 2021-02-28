import {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  AttributeIds,
  makeBrowsePath,
  ClientSubscription,
  TimestampsToReturn,
  MonitoringParametersOptions,
  ReadValueId,
  ClientMonitoredItem,
  DataValue
} from 'node-opcua';

const connectionStrategy = {
  initialDelay: 1000,
  maxRetry: 1
};
const client = OPCUAClient.create({
  applicationName: 'MyClient',
  connectionStrategy: connectionStrategy,
  securityMode: MessageSecurityMode.None,
  securityPolicy: SecurityPolicy.None,
  endpoint_must_exist: false
});
//const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";
const endpointUrl =
  'opc.tcp://' + require('os').hostname() + ':4334/UA/MyLittleServer';

async function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  try {
    // Step 1: connect to server
    await client.connect(endpointUrl);
    console.log(`Successfully connected to server "${endpointUrl}"`);

    // Step 2: create session
    const session = await client.createSession();
    console.log('Session created!');

    // step 3: Browse root folder. Receive all it's child nodes
    const browseResult = await session.browse('RootFolder');

    console.log('References of RootFolder:');
    for (const reference of browseResult.references) {
      console.log('   -> ', reference.browseName.toString());
    }

    // Step 4: Read variable with nodeId (ns) and attributeId (s)
    const nodeToRead = {
      nodeId: 'ns=1;s=free_memory',
      attributeId: AttributeIds.Value
    };
    const maxAge = 0;
    const dataValue2 = await session.read(nodeToRead, maxAge);
    console.log('----------------------');
    console.log('Variable s=free_memory');
    console.log(dataValue2.toString());
    console.log('----------------------');

    // Step 5: Finding the nodeId of a node by Browse name
    const browsePath = makeBrowsePath(
      'RootFolder',
      '/Objects/Server.ServerStatus.BuildInfo.ProductName'
    );
    const result = await session.translateBrowsePath(browsePath);
    const productNameNodeId = result.targets[0].targetId;
    console.log('Product Name nodeId = ', productNameNodeId.toString());

    // Step 6: Subscription (instead of poolling for changes). Monitor item for 10 seconds
    const subscription = ClientSubscription.create(session, {
      requestedPublishingInterval: 1000,
      requestedLifetimeCount: 100,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 100,
      publishingEnabled: true,
      priority: 10
    });
    subscription
      .on('started', function () {
        console.log(
          `subscription started for 2 seconds - subscriptionId=${subscription.subscriptionId}`
        );
      })
      .on('keepalive', function () {
        console.log('keepalive');
      })
      .on('terminated', function () {
        console.log('terminated');
      });

    // Install monitored item

    const itemToMonitor = {
      nodeId: 'ns=1;s=free_memory',
      attributeId: AttributeIds.Value
    };
    const parameters: MonitoringParametersOptions = {
      samplingInterval: 100,
      discardOldest: true,
      queueSize: 10
    };

    const monitoredItem = ClientMonitoredItem.create(
      subscription,
      itemToMonitor,
      parameters,
      TimestampsToReturn.Both
    );

    monitoredItem.on('changed', (dataValue: DataValue) => {
      console.log(' value has changed : ', dataValue.value.toString());
    });

    // await timeout(10000);

    // console.log('now terminating subscription');
    // await subscription.terminate();

    // // close session
    // await session.close();

    // // disconnecting
    // await client.disconnect();
    // console.log('Client disconnected!');
  } catch (err) {
    console.log('An error has occurred: ', err);
  }
}
main();

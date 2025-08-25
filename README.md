# Muna for JavaScript

![Muna logo](https://raw.githubusercontent.com/muna-ai/.github/main/logo_wide.png)

Run AI models anywhere.

> [!CAUTION]
> **Never embed access keys client-side (i.e. in the browser)**. Instead, create a proxy URL in your backend.

## Installing Muna
Muna is distributed on NPM. Open a terminal and run the following command:
```bash
# Run this in Terminal
$ npm install muna
```

## Retrieving your Access Key
Head over to [muna.ai](https://muna.ai) to create an account by logging in. Once you do, generate an access key:

![generate access key](https://raw.githubusercontent.com/muna-ai/.github/main/access_key.gif)

## Making a Prediction
First, create a Muna client, specifying your access key:
```js
import { Muna } from "muna"

// 💥 Create a Muna client
const muna = new Muna({ accessKey: "<ACCESS KEY>" });
```

Next, make a prediction:
```js
// 🔥 Make a prediction
const prediction = await muna.predictions.create({
    tag: "@fxn/greeting",
    inputs: { name: "Rhea" }
});
```

Finally, use the results:
```js
// 🚀 Use the results
console.log(prediction.results[0]);
```

___

## Useful Links
- [Discover predictors to use in your apps](https://muna.ai/explore).
- [Join our Slack community](https://muna.ai/slack).
- [Check out our docs](https://docs.muna.ai).
- Learn more about us [on our blog](https://blog.muna.ai).
- Reach out to us at [hi@muna.ai](mailto:hi@muna.ai).

Muna is a product of [NatML Inc](https://github.com/natmlx).

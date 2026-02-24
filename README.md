# Muna for JavaScript

![Muna logo](https://raw.githubusercontent.com/muna-ai/.github/main/banner.png)

Run AI models anywhere.

> [!CAUTION]
> **Never embed access keys client-side (i.e. in the browser)**. Instead, create a proxy URL in your backend.

## Installing Muna
Muna is distributed on NPM. Open a terminal and run the following command:
```bash
# Run this in Terminal
$ npm install muna
```

## Running a Model
First, create a Muna client, specifying your access key ([create one here](https://muna.ai/settings/developer)):

```js
import { Muna } from "muna"

// 💥 Create an OpenAI client
const openai = new Muna({ accessKey: "<ACCESS KEY>" }).beta.openai;
```

Next, run a model:
```js
// 🔥 Create a chat completion
const completion = openai.chat.completions.create({
  model: "@openai/gpt-oss-20b",
  messages: [
    { role: "user", content: "What is the capital of France?" }
  ],
  acceleration: "local_gpu"
});
```

Finally, use the results:
```js
// 🚀 Use the results
console.log(completion.choices[0].message);
```

___

## Useful Links
- [Check out several AI models we've compiled](https://muna.ai/explore).
- [Join our Slack community](https://muna.ai/slack).
- [Check out our docs](https://docs.muna.ai).
- [Read our blog](https://muna.ai/blog).
- Reach out to us at [hi@muna.ai](mailto:hi@muna.ai).

Muna is a product of [NatML Inc](https://github.com/natmlx).

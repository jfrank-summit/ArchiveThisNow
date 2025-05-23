import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('llm-service');

export type TweetContent = {
  text: string;
  username: string;
  timestamp?: string;
  media?: Array<{
    type: string;
    url?: string;
    description?: string;
  }>;
}

export type CommentaryResponse = {
  commentary: string;
  confidence: number;
  topics: string[];
}

type LLMProvider = ChatOpenAI | ChatAnthropic;

const createLLMProvider = (): LLMProvider => {
  const provider = process.env.LLM_PROVIDER || 'openai';
  
  switch (provider.toLowerCase()) {
    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required for Anthropic provider');
      }
      return new ChatAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
        temperature: 0.7,
      });
    case 'openai':
    default:
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is required for OpenAI provider');
      }
      return new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4',
        temperature: 0.7,
      });
  }
};

const createPromptTemplate = (): PromptTemplate => {
  const template = `You are an AI assistant helping to create engaging commentary for tweets that are being archived on the Autonomys network. 

Your task is to analyze the provided tweet content and generate relevant, insightful commentary that would be valuable when sharing the archive link.

The commentary should:
- Be concise (under 200 characters)
- Highlight key insights or important aspects of the tweet
- Be relevant and add value to the original content
- Be engaging and encourage interaction
- Reference why this content is worth preserving/archiving
- Be appropriate for a professional social media response

Tweet Content:
Username: {username}
Text: {text}
Timestamp: {timestamp}
Media: {media}

Additional Context:
- This tweet is being archived on Autonomys, a blockchain-based permanent decentralized storage network
- The archive will be permanently accessible via the provided link
- Your commentary will be part of a response tweet that includes the archive link

Generate commentary that would make people interested in viewing the archived content. Focus on what makes this tweet significant, interesting, or worth preserving.

IMPORTANT: You must respond with ONLY valid JSON. Do not include any explanatory text before or after the JSON. The response must be parseable by JSON.parse().

Required JSON format:
{{
  "commentary": "Your engaging commentary here (under 200 characters)",
  "confidence": 0.85,
  "topics": ["topic1", "topic2", "topic3"]
}}

Where:
- commentary: string (required, under 200 characters)
- confidence: number between 0 and 1 (required)
- topics: array of 2-5 strings representing key themes (required)

Respond with valid JSON only:`;

  return PromptTemplate.fromTemplate(template);
};

// Lazy initialization - providers created only when first used
let llmProvider: LLMProvider | null = null;
let promptTemplate: PromptTemplate | null = null;

const getLLMProvider = (): LLMProvider => {
  if (!llmProvider) {
    llmProvider = createLLMProvider();
  }
  return llmProvider;
};

const getPromptTemplate = (): PromptTemplate => {
  if (!promptTemplate) {
    promptTemplate = createPromptTemplate();
  }
  return promptTemplate;
};

export const generateCommentary = async (tweetContent: TweetContent): Promise<CommentaryResponse> => {
  try {
    logger.info(`Generating commentary for tweet from @${tweetContent.username}`);

    const mediaDescription = tweetContent.media?.length 
      ? tweetContent.media.map(m => `${m.type}: ${m.description || 'No description'}`).join(', ')
      : 'No media';

    const prompt = await getPromptTemplate().format({
      username: tweetContent.username,
      text: tweetContent.text,
      timestamp: tweetContent.timestamp || 'Unknown',
      media: mediaDescription,
    });

    const response = await getLLMProvider().invoke(prompt);
    const content = typeof response.content === 'string' ? response.content : String(response.content);

    // Debug: Log the raw LLM response
    logger.info(`Raw LLM response: ${content}`);

    // Parse JSON response
    try {
      const parsed = JSON.parse(content);
      
      // Simple validation
      if (!parsed.commentary || typeof parsed.commentary !== 'string') {
        throw new Error('Invalid commentary in response');
      }

      const result: CommentaryResponse = {
        commentary: parsed.commentary,
        confidence: parsed.confidence || 0.5,
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      };

      logger.info(`Generated commentary with confidence ${result.confidence}: "${result.commentary.substring(0, 50)}..."`);
      return result;

    } catch (parseError) {
      logger.warn(`Failed to parse LLM JSON response: ${parseError}`);
      logger.warn(`LLM returned: "${content}"`);
      
      // Fallback: extract commentary from the response text
      const commentaryMatch = content.match(/"commentary":\s*"([^"]+)"/);
      const commentary = commentaryMatch?.[1] || content.substring(0, 100);
      
      return {
        commentary,
        confidence: 0.2,
        topics: ['general'],
      };
    }

  } catch (error) {
    logger.error('Error generating commentary:', error);
    
    // Fallback commentary
    return {
      commentary: `Interesting content from @${tweetContent.username} worth preserving for future reference.`,
      confidence: 0.1,
      topics: ['general'],
    };
  }
};

export const testConnection = async (): Promise<boolean> => {
  try {
    const testResponse = await getLLMProvider().invoke('Test connection - respond with "OK"');
    logger.info('LLM connection test successful');
    return true;
  } catch (error) {
    logger.error('LLM connection test failed:', error);
    return false;
  }
}; 
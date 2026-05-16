const axios = require('axios');
const config = require('../config/env');

class OpenRouterService {
  constructor() {
    this.apiKey = config.openRouterApiKey;
    this.baseUrl = 'https://openrouter.ai/api/v1';
    this.defaultModel = config.openRouterModel;
  }

  async generateCompletion(messages, model = null, options = {}) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: model || this.defaultModel,
          messages,
          temperature: options.temperature || 0.3,
          max_tokens: options.maxTokens || 1000,
          top_p: options.topP || 1,
          frequency_penalty: options.frequencyPenalty || 0,
          presence_penalty: options.presencePenalty || 0,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://geo-outreach-platform.com',
            'X-Title': 'Geo Outreach Platform',
          },
        }
      );

      return {
        content: response.data.choices[0].message.content,
        model: response.data.model,
        usage: response.data.usage,
      };
    } catch (error) {
      console.error('OpenRouter API Error:', error.response?.data || error.message);
      throw new Error(`AI generation failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async generateBusinessSummary(businessData) {
    const prompt = this.createBusinessSummaryPrompt(businessData);
    
    const messages = [
      {
        role: 'system',
        content: 'You are a business analyst expert. Generate concise, professional business summaries.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const result = await this.generateCompletion(messages, null, {
      temperature: 0.3,
      maxTokens: 300,
    });

    return result.content;
  }

  async generateOutreachMessage(businessData, userGoal = null) {
    const prompt = this.createOutreachPrompt(businessData, userGoal);
    
    const messages = [
      {
        role: 'system',
        content: 'You are a professional business communication expert. Generate personalized, friendly, and professional outreach messages.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const result = await this.generateCompletion(messages, null, {
      temperature: 0.7,
      maxTokens: 500,
    });

    return result.content;
  }

  async generateBulkOutreach(businessesData, userGoal = null) {
    const messages = businessesData.map((business) => ({
      businessId: business._id,
      businessName: business.name,
    }));

    const results = await Promise.all(
      businessesData.map(async (business) => {
        try {
          const message = await this.generateOutreachMessage(business, userGoal);
          return {
            businessId: business._id,
            businessName: business.name,
            message,
            success: true,
          };
        } catch (error) {
          return {
            businessId: business._id,
            businessName: business.name,
            error: error.message,
            success: false,
          };
        }
      })
    );

    return results;
  }

  createBusinessSummaryPrompt(businessData) {
    return `Generate a brief professional summary (2-3 sentences) for the following business:

Business Name: ${businessData.name}
Category: ${businessData.category}
Location: ${businessData.address?.formatted || businessData.address?.city || 'N/A'}
${businessData.rating ? `Rating: ${businessData.rating}/5 (${businessData.totalRatings || 0} reviews)` : ''}
${businessData.website ? `Website: ${businessData.website}` : ''}

Focus on what makes this business unique and valuable to potential customers.`;
  }

  createOutreachPrompt(businessData, userGoal) {
    const goalText = userGoal || 'introduce our services and explore potential partnership opportunities';

    return `Generate a personalized, professional outreach email message for the following business:

Business Name: ${businessData.name}
Category: ${businessData.category}
Location: ${businessData.address?.formatted || businessData.address?.city || 'N/A'}
${businessData.rating ? `Rating: ${businessData.rating}/5` : ''}
${businessData.website ? `Website: ${businessData.website}` : ''}

Purpose: ${goalText}

Requirements:
1. Keep it concise (150-200 words)
2. Professional yet friendly tone
3. Personalize based on their business type and location
4. Include a clear call-to-action
5. Do NOT include subject line, just the email body
6. Do NOT include placeholder fields like [Your Name] - keep it generic enough to be customized

Generate only the email body text.`;
  }

  async scoreLeads(businessesData, criteria = {}) {
    const prompt = `Score the following businesses as potential leads on a scale of 1-10 based on:
- Business rating and reviews
- Category relevance
- Location accessibility
${criteria.industry ? `- Relevance to ${criteria.industry} industry` : ''}

Businesses:
${businessesData.map((b, i) => `${i + 1}. ${b.name} - ${b.category} - Rating: ${b.rating || 'N/A'}`).join('\n')}

Return ONLY a JSON array with format: [{"businessId": "id", "score": number, "reason": "brief reason"}]`;

    const messages = [
      {
        role: 'system',
        content: 'You are a lead scoring expert. Return only valid JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    try {
      const result = await this.generateCompletion(messages, null, {
        temperature: 0.3,
        maxTokens: 1000,
      });

      return JSON.parse(result.content);
    } catch (error) {
      throw new Error(`Lead scoring failed: ${error.message}`);
    }
  }
}

module.exports = new OpenRouterService();

const axios = require('axios');
const config = require('../config/env');

class AnthropicService {
  constructor() {
    this.apiKey = config.anthropic.apiKey;
    this.model = config.anthropic.model;
    this.maxTokens = config.anthropic.maxTokens;
    this.baseUrl = 'https://api.anthropic.com/v1';
  }

  async generateCompletion(systemPrompt, userMessage, options = {}) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/messages`,
        {
          model: this.model,
          max_tokens: options.maxTokens || this.maxTokens,
          messages: [
            { role: 'user', content: userMessage },
          ],
          system: systemPrompt,
          temperature: options.temperature || 0.3,
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.content[0]?.text || '';
      return {
        content,
        model: response.data.model,
        usage: response.data.usage,
      };
    } catch (error) {
      console.error('Anthropic API Error:', error.response?.data || error.message);
      throw new Error(`AI generation failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async generateBusinessSummary(businessData) {
    // const systemPrompt = 'You are a business analyst expert. Generate concise, professional business summaries.';
    // const userMessage = this.createBusinessSummaryPrompt(businessData);

    // const result = await this.generateCompletion(systemPrompt, userMessage, {
    //   temperature: 0.3,
    //   maxTokens: 300,
    // });

    // return result.content;
    return null;
  }

  async generateOutreachMessage(businessData, userGoal = null) {
    // const systemPrompt = 'You are a professional business communication expert. Generate personalized, friendly, and professional outreach messages.';
    // const userMessage = this.createOutreachPrompt(businessData, userGoal);

    // const result = await this.generateCompletion(systemPrompt, userMessage, {
    //   temperature: 0.7,
    //   maxTokens: 500,
    // });

    // return result.content;
    return null;
  }

  async generateBulkOutreach(businessesData, userGoal = null) {
    // const results = await Promise.all(
    //   businessesData.map(async (business) => {
    //     try {
    //       const message = await this.generateOutreachMessage(business, userGoal);
    //       return {
    //         businessId: business._id,
    //         businessName: business.name,
    //         message,
    //         success: true,
    //       };
    //     } catch (error) {
    //       return {
    //         businessId: business._id,
    //         businessName: business.name,
    //         error: error.message,
    //         success: false,
    //       };
    //     }
    //   })
    // );

    // return results;
    return [];
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
    const systemPrompt = 'You are a lead scoring expert. Return only valid JSON.';
    const userMessage = `Score the following businesses as potential leads on a scale of 1-10 based on:
- Business rating and reviews
- Category relevance
- Location accessibility
${criteria.industry ? `- Relevance to ${criteria.industry} industry` : ''}

Businesses:
${businessesData.map((b, i) => `${i + 1}. ${b.name} - ${b.category} - Rating: ${b.rating || 'N/A'}`).join('\n')}

Return ONLY a JSON array with format: [{"businessId": "id", "score": number, "reason": "brief reason"}]`;

    try {
      const result = await this.generateCompletion(systemPrompt, userMessage, {
        temperature: 0.3,
        maxTokens: 1000,
      });

      return JSON.parse(result.content);
    } catch (error) {
      throw new Error(`Lead scoring failed: ${error.message}`);
    }
  }
}

module.exports = new AnthropicService();

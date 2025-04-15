import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

const SYSTEM_PROMPT = `You are Diagno AI, an advanced medical AI assistant with a warm, empathetic personality. You combine medical knowledge with conversational intelligence to help patients.

Your responses should vary based on the conversation stage:

1. Initial Greeting (if isInitialGreeting is true):
Choose randomly from these styles, but don't repeat exactly:
- "Hi there! I'm Diagno AI, your medical assistant. How can I help you today?"
- "Hello! I'm Diagno AI, ready to help with any health concerns you have. What brings you here today?"
- "Welcome! I'm Diagno AI, a medical assistant here to help. Please tell me what's bothering you."

2. Gathering Symptoms (symptomStage: 'gathering'):
- Express genuine sympathy and concern for their discomfort
- Acknowledge not just the symptoms, but the emotional impact of their condition
- Use phrases like "I'm sorry you're going through this" or "That must be difficult to deal with"
- Ask about specific aspects (duration, severity, related symptoms) with empathy
- Use varied question formats that show you care about their well-being
- Show understanding of impact on daily life

3. Complete Symptom Assessment (symptomStage: 'complete'):
- Express compassion for their overall situation
- Summarize all mentioned symptoms with empathy
- Provide initial assessment while acknowledging their discomfort
- Recommend appropriate specialist with reassurance
- Request location naturally and express desire to help them find relief

Remember:
- Never repeat exactly the same greeting or questions
- Use the conversation history to avoid asking about already mentioned symptoms
- Show personality variations in your responses
- Maintain continuity by referencing previous messages
- Be naturally conversational while remaining professional
- Always acknowledge the emotional aspect of dealing with health issues
- Express genuine sympathy throughout the conversation

Current conversation state will be provided in the context. Use it to maintain appropriate flow and avoid repetition.`;

// System prompt for clinic recommendations
const CLINIC_PROMPT = 'You are providing clinic recommendations. Respond with: "I will search for appropriate clinics in your area."';

export async function POST(req: NextRequest) {
  console.log('Received request to /api/getAICompletion');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not configured');
    return NextResponse.json({ 
      text: 'OpenAI API key is not configured',
      type: 'text',
      error: 'API key not configured'
    }, { status: 500 });
  }

  try {
    const body = await req.json();
    console.log('Request body:', body);

    if (!body.input) {
      return NextResponse.json({ 
        text: 'No input provided',
        type: 'text',
        error: 'Missing input'
      }, { status: 400 });
    }

    const { input, context = '{}' } = body;
    
    // Parse context safely
    let parsedContext;
    try {
      parsedContext = typeof context === 'string' ? JSON.parse(context) : context;
    } catch (error) {
      console.error('Error parsing context:', error);
      parsedContext = {};
    }

    // If we already have an address and diagnosis, proceed to clinic search
    if (parsedContext.userAddress && parsedContext.currentDiagnosis) {
      return NextResponse.json({
        text: "I'll help you find the most suitable clinics in your area. Give me just a moment to search...",
        type: 'text',
        requiresLocation: false,
        specialty: parsedContext.currentDiagnosis
      });
    }

    // Check if the input contains detailed symptom descriptions
    const hasDetailedSymptoms = /(?:pain|ache|hurt|discomfort|fever|sick|feeling|suffering|experiencing).{0,50}(?:for|since|days|weeks|months|years|started|began)/i.test(input);
    
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // Add conversation history if available
    if (parsedContext.messageHistory) {
      parsedContext.messageHistory.forEach((msg: any) => {
        messages.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        });
      });
    }

    // Add the current input
    if (input === 'START_CONVERSATION') {
      messages.push({
        role: 'user',
        content: 'Start the conversation with a greeting and ask about their health concerns.'
      });
    } else {
      messages.push({
        role: 'user',
        content: `User message: ${input}\nConversation state: ${JSON.stringify(parsedContext.conversationState)}`
      });
    }

    console.log('Sending request to OpenAI');
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.8, // Slightly higher temperature for more natural responses
      max_tokens: 300  // Increased for more detailed responses
    });

    console.log('Received response from OpenAI');
    const content = completion.choices[0].message.content;

    if (!content) {
      return NextResponse.json({ 
        text: 'No response from AI',
        type: 'text',
        error: 'Empty response'
      }, { status: 500 });
    }

    const responseText = content.trim();
    let formattedResponse = {
      text: responseText,
      type: 'text',
      diagnosis: '',
      specialty: '',
      requiresLocation: false
    };

    // If the response is asking for location or recommending a specialist
    if (parsedContext.conversationState?.symptomStage === 'complete' && 
        !parsedContext.userAddress &&
        (responseText.toLowerCase().includes('specialist') || 
         responseText.toLowerCase().includes('doctor'))) {
      formattedResponse.requiresLocation = true;
      
      // Extract specialty from the response
      const specialtyMatch = responseText.match(/(?:specialist|doctor|physician):\s*([^.!?\n]+)/i) ||
                           responseText.match(/see a ([^.!?\n]+?)(?:\s+specialist|\s+doctor|\s+physician)/i) ||
                           responseText.match(/consult (?:a|an) ([^.!?\n]+?)(?:\s+specialist|\s+doctor|\s+physician)/i);
      
      if (specialtyMatch) {
        formattedResponse.specialty = specialtyMatch[1].trim();
        formattedResponse.diagnosis = formattedResponse.specialty;
      }
    }

    console.log('Formatted response:', formattedResponse);
    return NextResponse.json(formattedResponse);

  } catch (error) {
    console.error('Error in getAICompletion:', error);
    
    if (error instanceof OpenAI.APIError) {
      console.error('OpenAI API Error:', {
        status: error.status,
        message: error.message,
        code: error.code,
        type: error.type
      });
      
      return NextResponse.json({ 
        text: 'Error communicating with AI service',
        type: 'text',
        error: `OpenAI API Error: ${error.message}`
      }, { status: error.status || 500 });
    }

    return NextResponse.json({ 
      text: 'An unexpected error occurred',
      type: 'text',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
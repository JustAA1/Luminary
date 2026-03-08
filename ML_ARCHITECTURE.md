# Luminary ML architecture (1-Minute DS Track Pitch)

**[0:00 - 0:15] The Challenge & Overview**
"Hi everyone. For the ML and Data Science track, our goal was to build a data-driven solution that uncovers insights, makes predictions, and automates decision-making. That's why we built Luminary—a custom, four-phase Machine Learning pipeline built natively in PyTorch to dynamically generate and automate personalized learning roadmaps using strict Topological Sorting."

**[0:15 - 0:35] Uncovering Insights & Making Predictions**
"First, we uncover insights from unstructured data. Our **UserProfile MLP** mathematically embeds a user’s resume and self-assessed skills into a 128-dimensional dense space, trained with *Triplet Margin Loss* to uncover exactly what concepts they’ve mastered versus what they need to learn. Second, we make temporal predictions. Our **TrendGRU** processes variable-length sequences of interactions, predicting whether a user's comprehension in a specific domain is accelerating, stable, or fading."

**[0:35 - 0:50] Automating Decision-Making**
"Third, we automate decision-making. Our multi-head **Signal Classifier**—a neural network with residual connections—extracts text embeddings from live user chat. It simultaneously predicts the relevant curriculum topic, classifies it as new info or contradiction, and calculates signal strength, instantly automating updates to their knowledge graph. We then pass this rigorously scored matrix to Gemini 2.5 Flash, which appends natural-language 'Why this matters' contextual tips."

**[0:50 - 1:00] The Impact**
"By combining deep recurrent networks for predictive tracking, custom PyTorch classifiers for automated routing, and LLMs for localized insights, Luminary structurally adapts to the human brain perfectly tackling the data challenge. Thank you."

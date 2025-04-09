const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// Connexion MongoDB
mongoose.connect('mongodb://localhost:27017/analytics', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('MongoDB connecté'))
    .catch(err => console.error('Erreur MongoDB :', err));

// Schémas généraux
const commonFields = {
    source: String,
    url: String,
    visitor: String,
    createdAt: { type: Date, default: Date.now },
    meta: mongoose.Schema.Types.Mixed,
};

// Modèles
const View = mongoose.model('View', new mongoose.Schema(commonFields));
const Action = mongoose.model('Action', new mongoose.Schema({
    ...commonFields,
    action: String,
}));
const Goal = mongoose.model('Goal', new mongoose.Schema({
    ...commonFields,
    goal: String,
}));

// Routes
app.post('/views', async (req, res) => {
    try {
        const view = new View(req.body);
        await view.save();
        res.status(201).json(view);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/actions', async (req, res) => {
    try {
        const action = new Action(req.body);
        await action.save();
        res.status(201).json(action);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/goals', async (req, res) => {
    try {
        const goal = new Goal(req.body);
        await goal.save();
        res.status(201).json(goal);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get('/goals/:goalId/details', async (req, res) => {
    try {
        const goal = await Goal.findById(req.params.goalId);
        if (!goal) return res.status(404).json({ error: 'Goal non trouvé' });

        const visitorId = goal.visitor;

        // Récupération des views et actions liés à ce visitor
        const [views, actions] = await Promise.all([
            View.find({ visitor: visitorId }),
            Action.find({ visitor: visitorId })
        ]);

        res.json({
            goal,
            views,
            actions
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


const PORT = 3000;
app.listen(PORT, () => console.log(`Serveur API en écoute sur http://localhost:${PORT}`));

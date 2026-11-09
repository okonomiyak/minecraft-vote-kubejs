// kubejs/server_scripts/vote.js

var voteState = {
    active: false,
    votes: {},       // { username: choiceIndex }
    options: []       // [{ label }]
}

function announceOptions(server) {
    var msg = Text.of('§e=== 投票選択肢 ===\n')
    voteState.options.forEach((opt, i) => {
        msg = msg.append(Text.of(`§7${i + 1}. ${opt.label}\n`))
    })
    server.tell(msg)
}

function startVote(server, durationSeconds) {
    if (voteState.options.length < 2) {
        server.tell(Text.of('§c選択肢が2つ以上登録されていません (/vote option add で追加してください)'))
        return
    }

    voteState.active = true
    voteState.votes = {}

    var msg = Text.of(`§e=== 投票開始 (${durationSeconds}秒) ===\n`)
    voteState.options.forEach((opt, i) => {
        var line = Text.of(`§a[${i + 1}] ${opt.label}`)
            .clickRunCommand(`/vote cast ${i + 1}`)
            .hover(Text.of(`クリックで「${opt.label}」に投票`))
        msg = msg.append(line).append(Text.of('\n'))
    })
    server.tell(msg)

    server.scheduleInTicks(durationSeconds * 20, () => {
        finishVote(server)
    })
}

function finishVote(server) {
    if (!voteState.active) return
    voteState.active = false

    var counts = voteState.options.map(() => 0)
    Object.values(voteState.votes).forEach(choice => {
        counts[choice - 1]++
    })

    var totalVotes = Object.keys(voteState.votes).length
    if (totalVotes === 0) {
        server.tell(Text.of('§c投票がありませんでした。キャンセルします'))
        return
    }

    var maxCount = Math.max.apply(null, counts)
    var winners = []
    counts.forEach((c, i) => { if (c === maxCount) winners.push(i) })

    var winnerIndex = winners[Math.floor(Math.random() * winners.length)]
    var winner = voteState.options[winnerIndex]

    // 全選択肢の結果を表示
    var msg = Text.of('§e=== 投票結果 ===\n')
    voteState.options.forEach((opt, i) => {
        msg = msg.append(Text.of(`§7${opt.label}: ${counts[i]}票\n`))
    })
    msg = msg.append(Text.of(`§b優勝: 「${winner.label}」 (${maxCount}/${totalVotes}票)`))
    server.tell(msg)
}

ServerEvents.commandRegistry(event => {
    const { commands: Commands, arguments: Arguments } = event

    event.register(
        Commands.literal('vote')
            // /vote option add <label>
            .then(Commands.literal('option')
                .then(Commands.literal('add')
                    .requires(src => src.hasPermission(2))
                    .then(Commands.argument('label', Arguments.STRING.create(event))
                        .executes(ctx => {
                            var label = Arguments.STRING.getResult(ctx, 'label')
                            voteState.options.push({ label: label })
                            ctx.source.sendSuccess(Text.of(`§a選択肢「${label}」を追加しました (${voteState.options.length}件)`), true)
                            return 1
                        })
                    )
                )
                .then(Commands.literal('clear')
                    .requires(src => src.hasPermission(2))
                    .executes(ctx => {
                        voteState.options = []
                        ctx.source.sendSuccess(Text.of('§a選択肢をクリアしました'), true)
                        return 1
                    })
                )
                .then(Commands.literal('list')
                    .executes(ctx => {
                        announceOptions(ctx.source.server)
                        return 1
                    })
                )
            )
            // /vote start <duration_seconds>
            .then(Commands.literal('start')
                .requires(src => src.hasPermission(2))
                .then(Commands.argument('seconds', Arguments.INTEGER.create(event))
                    .executes(ctx => {
                        if (voteState.active) {
                            ctx.source.sendFailure(Text.of('§c既に投票が進行中です'))
                            return 0
                        }
                        var seconds = Arguments.INTEGER.getResult(ctx, 'seconds')
                        startVote(ctx.source.server, seconds)
                        return 1
                    })
                )
            )
            // /vote cast <choice>
            .then(Commands.literal('cast')
                .then(Commands.argument('choice', Arguments.INTEGER.create(event))
                    .executes(ctx => {
                        if (!voteState.active) {
                            ctx.source.sendFailure(Text.of('§c現在投票は行われていません'))
                            return 0
                        }
                        var choice = Arguments.INTEGER.getResult(ctx, 'choice')
                        if (choice < 1 || choice > voteState.options.length) {
                            ctx.source.sendFailure(Text.of('§c無効な選択肢です'))
                            return 0
                        }
                        var username = ctx.source.player.username
                        voteState.votes[username] = choice
                        ctx.source.sendSuccess(Text.of(`§a「${voteState.options[choice - 1].label}」に投票しました`), false)
                        return 1
                    })
                )
            )
    )
})

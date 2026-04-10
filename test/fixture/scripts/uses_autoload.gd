extends Node2D

func _ready() -> void:
	GameState.score += 1
	print("Score is: ", GameState.score)
